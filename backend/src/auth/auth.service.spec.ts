import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { RolUsuario, Usuario } from '../usuarios/usuario.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let passwordHash: string;

  // Cadena de consultas que simula createQueryBuilder de TypeORM.
  // Cada método se encadena y al final getOne devuelve el usuario.
  const consulta = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn<() => Promise<Partial<Usuario> | null>>(),
  };

  // Repositorio falso: solo necesitamos createQueryBuilder.
  const repositorio = {
    createQueryBuilder: jest.fn().mockReturnValue(consulta),
  };

  // Servicio JWT falso: controlamos qué token "firma".
  const jwt = {
    signAsync:
      jest.fn<(payload: { sub: string; rol: RolUsuario }) => Promise<string>>(),
  };

  beforeAll(async () => {
    // Coste bajo (4) solo para que las pruebas no tarden.
    // En producción el coste real es mucho mayor.
    passwordHash = await bcrypt.hash('Prueba123!', 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Por defecto existe un usuario con la contraseña correcta.
    consulta.getOne.mockResolvedValue({
      id: 'usuario-1',
      nombre: 'Cliente de prueba',
      email: 'cliente@example.com',
      passwordHash,
      rol: RolUsuario.CLIENTE,
    });

    jwt.signAsync.mockResolvedValue('token-de-prueba');

    // Monta AuthService con repositorio y JwtService falsos.
    const modulo = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Usuario),
          useValue: repositorio,
        },
        {
          provide: JwtService,
          useValue: jwt,
        },
      ],
    }).compile();

    service = modulo.get(AuthService);
  });

  it('devuelve un token y los datos públicos del usuario', async () => {
    // Login correcto: email y contraseña coinciden.
    const resultado = await service.login({
      email: 'cliente@example.com',
      password: 'Prueba123!',
    });

    // El token se firma con el id y el rol del usuario.
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'usuario-1',
      rol: RolUsuario.CLIENTE,
    });

    // Respuesta pública: token Bearer + datos del usuario.
    expect(resultado).toEqual({
      access_token: 'token-de-prueba',
      token_type: 'Bearer',
      expires_in: 3600,
      usuario: {
        id: 'usuario-1',
        nombre: 'Cliente de prueba',
        email: 'cliente@example.com',
        rol: RolUsuario.CLIENTE,
      },
    });

    // La contraseña hasheada nunca debe salir en la respuesta.
    expect(resultado.usuario).not.toHaveProperty('passwordHash');
  });

  it('rechaza una contraseña incorrecta y no genera token', async () => {
    // Credenciales inválidas: HTTP 401.
    await expect(
      service.login({
        email: 'cliente@example.com',
        password: 'Incorrecta123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    // Si la contraseña falla, no tiene sentido firmar un JWT.
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rechaza un usuario inexistente y no genera token', async () => {
    // Simula que el email no existe en la base.
    consulta.getOne.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'noexiste@example.com',
        password: 'Prueba123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    // Mismo resultado que contraseña incorrecta: no filtramos si el email existe.
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
