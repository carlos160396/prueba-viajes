import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestAutenticada } from '../types/usuario-autenticado';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lee @Roles() del método o, si no hay, del controller.
    const rolesPermitidos = this.reflector.getAllAndOverride<RolUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin @Roles() este guard no restringe; JwtAuthGuard sigue aplicando.
    if (!rolesPermitidos) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestAutenticada>();

    // Ruta restringida pero nadie autenticado: 401.
    if (!request.user) {
      throw new UnauthorizedException('Autenticación requerida');
    }

    // Identificado, pero su rol no está en la lista: 403.
    if (!rolesPermitidos.includes(request.user.rol)) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción',
      );
    }

    return true;
  }
}
