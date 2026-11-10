import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  async login(datos: LoginDto) {
    // passwordHash está oculto por select: false; hay que pedirlo explícito.
    const usuario = await this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.email = :email', { email: datos.email })
      .getOne();

    // Mismo mensaje si el email no existe o la contraseña falla:
    // así no se revela si la cuenta está registrada.
    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordValida = await bcrypt.compare(
      datos.password,
      usuario.passwordHash,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // El token lleva el id (sub) y el rol; JwtAuthGuard los leerá después.
    const accessToken = await this.jwtService.signAsync({
      sub: usuario.id,
      rol: usuario.rol,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    };
  }
}
