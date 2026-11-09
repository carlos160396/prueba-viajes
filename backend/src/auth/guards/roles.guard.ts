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
    const rolesPermitidos = this.reflector.getAllAndOverride<RolUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesPermitidos) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestAutenticada>();

    if (!request.user) {
      throw new UnauthorizedException('Autenticación requerida');
    }

    if (!rolesPermitidos.includes(request.user.rol)) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción',
      );
    }

    return true;
  }
}
