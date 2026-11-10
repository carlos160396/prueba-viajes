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

  // true = la petición puede continuar; si falla, lanza 401.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestAutenticada>();

    const authorization = request.headers.authorization;
    const partes = authorization?.split(' ');

    // El encabezado debe ser exactamente: Authorization: Bearer <token>
    if (partes?.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {
      throw new UnauthorizedException('Token requerido');
    }

    let payload: Record<string, unknown>;

    try {
      // Comprueba firma, expiración y algoritmo HS256.
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
        partes[1],
        {
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }

    // El rol del token debe coincidir con un valor del enum.
    const rol = Object.values(RolUsuario).find(
      (valor) => valor === payload.rol,
    );

    // sub es el id del usuario; sin él o sin rol válido el token no sirve.
    if (typeof payload.sub !== 'string' || !payload.sub || !rol) {
      throw new UnauthorizedException('Token invalido');
    }

    // Deja al usuario en el request para RolesGuard y los controladores.
    request.user = {
      id: payload.sub,
      rol,
    };
    return true;
  }
}
