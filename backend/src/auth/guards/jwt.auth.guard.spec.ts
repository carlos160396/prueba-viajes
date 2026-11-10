import { beforeEach, describe, expect, it } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let jwt: JwtService;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    // Esta clave se usa únicamente en pruebas, sin leer el .env.
    jwt = new JwtService({
      secret: 'clave-exclusiva-para-pruebas-jwt',
    });

    guard = new JwtAuthGuard(jwt);
  });

  function crearContexto(authorization?: string) {
    // Request falso: solo headers y el hueco donde el guard pondrá user.
    const request: {
      headers: { authorization?: string };
      user?: { id: string; rol: RolUsuario };
    } = {
      headers: { authorization },
    };

    // Simulamos solo la parte del contexto HTTP que utiliza el guard.
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { request, context };
  }

  it('acepta un token válido y agrega el usuario al request', async () => {
    // Token firmado con la misma clave que usa el guard.
    const token = await jwt.signAsync(
      {
        sub: 'cliente-1',
        rol: RolUsuario.CLIENTE,
      },
      { expiresIn: '1h' },
    );

    const { request, context } = crearContexto(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    // Tras validar el token, el guard deja al usuario listo
    // para que RolesGuard u otros handlers lo lean.
    expect(request.user).toEqual({
      id: 'cliente-1',
      rol: RolUsuario.CLIENTE,
    });
  });

  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer a b'])(
    'rechaza un encabezado incorrecto: %s',
    async (authorization) => {
      const { request, context } = crearContexto(authorization);

      // Sin "Bearer <token>" bien formado no hay autenticación.
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(request.user).toBeUndefined();
    },
  );

  it('rechaza un token firmado con otra clave', async () => {
    // Firmamos con una clave distinta a la del guard.
    // Así comprobamos que no acepta tokens de otro emisor.
    const token = await jwt.signAsync(
      {
        sub: 'cliente-1',
        rol: RolUsuario.CLIENTE,
      },
      { secret: 'otra-clave-de-prueba' },
    );

    const { request, context } = crearContexto(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(request.user).toBeUndefined();
  });

  it('rechaza un token expirado', async () => {
    const token = await jwt.signAsync(
      {
        sub: 'cliente-1',
        rol: RolUsuario.CLIENTE,
      },
      // Expira en el pasado para probar sin esperar.
      { expiresIn: -1 },
    );

    const { request, context } = crearContexto(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(request.user).toBeUndefined();
  });

  it('rechaza un token sin identificador de usuario', async () => {
    // Falta "sub": el payload no identifica a nadie.
    const token = await jwt.signAsync({
      rol: RolUsuario.CLIENTE,
    });

    const { context } = crearContexto(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token con un rol desconocido', async () => {
    // El rol debe ser uno de los valores del enum RolUsuario.
    const token = await jwt.signAsync({
      sub: 'cliente-1',
      rol: 'rol-inexistente',
    });

    const { context } = crearContexto(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
