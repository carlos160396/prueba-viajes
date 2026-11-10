import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../usuarios/usuario.entity';

// Clave con la que Nest guarda los roles en el metadata del endpoint.
export const ROLES_KEY = 'roles';

// Uso: @Roles(RolUsuario.ADMIN)
// RolesGuard lee esta metadata para saber quién puede entrar.
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
