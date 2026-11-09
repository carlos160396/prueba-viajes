import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestAutenticada } from '../types/usuario-autenticado';
import { RolUsuario } from '../../usuarios/usuario.entity';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestAutenticada>();

    const authorization = request.headers.authorization;
    const partes = authorization?.split(' ');

    if (partes?.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {
      throw new UnauthorizedException('Token requerido');
    }

    let payload: Record<string, unknown>;

    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
        partes[1],
        {
          algorithms: ['HS256'],
        },
      );
    } catch (error) {
      throw new UnauthorizedException('Token invalido o expirado');
    }

    const rol = Object.values(RolUsuario).find(
      (valor) => valor === payload.rol,
    );

    if (typeof payload.sub !== 'string' || !payload.sub || !rol) {
      throw new UnauthorizedException('Token invalido');
    }

    request.user = {
      id: payload.sub,
      rol,
    };
    return true;
  }
}
