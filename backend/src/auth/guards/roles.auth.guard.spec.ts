import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '../../usuarios/usuario.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    // Usamos el Reflector real de Nest para leer los permisos
    // que normalmente configura el decorador @Roles().
    guard = new RolesGuard(new Reflector());
  });

  // Arma un ExecutionContext falso con roles opcionales y un usuario.
  function crearContexto(
    rolesPermitidos?: RolUsuario[],
    usuario?: { id: string; rol: RolUsuario },
  ): ExecutionContext {
    // Representan el método y el controller de un endpoint.
    // Creamos otros nuevos en cada prueba para no compartir permisos.
    const handler = () => undefined;
    class ControllerDePrueba {}

    if (rolesPermitidos !== undefined) {
      // Equivale a guardar los permisos que declara @Roles()
      // sobre el método del controller.
      Reflect.defineMetadata(ROLES_KEY, rolesPermitidos, handler);
    }
    // Si no pasamos roles, no hay metadata: la ruta queda abierta.

    const request = {
      // En una petición real, JwtAuthGuard agrega este usuario
      // después de comprobar el token.
      user: usuario,
    };

    // Simulamos las partes del contexto que consulta RolesGuard.
    return {
      getHandler: () => handler,
      getClass: () => ControllerDePrueba,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('permite continuar si el endpoint no declara restricciones de rol', () => {
    // Sin @Roles() y sin usuario: este guard no bloquea.
    const context = crearContexto();

    // Este guard no exige un rol cuando no hay @Roles().
    // La autenticación sigue dependiendo del guard de JWT.
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rechaza una ruta restringida si no hay usuario autenticado', () => {
    // Hay @Roles(ADMIN), pero request.user no viene definido.
    const context = crearContexto([RolUsuario.ADMIN]);

    // La ruta requiere administrador, pero no tenemos usuario.
    // Debe producir un error de autenticación: HTTP 401.
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rechaza a un cliente cuando la ruta requiere administrador', () => {
    // Usuario autenticado como CLIENTE frente a una ruta de ADMIN.
    const context = crearContexto([RolUsuario.ADMIN], {
      id: 'cliente-1',
      rol: RolUsuario.CLIENTE,
    });

    // El usuario está identificado, pero no tiene permiso.
    // Por eso esperamos HTTP 403, en lugar de HTTP 401.
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permite el acceso cuando el rol está entre los autorizados', () => {
    // La ruta acepta ADMIN o AGENTE; el usuario es AGENTE.
    const context = crearContexto([RolUsuario.ADMIN, RolUsuario.AGENTE], {
      id: 'agente-1',
      rol: RolUsuario.AGENTE,
    });

    // Basta con coincidir con uno de los roles permitidos.
    expect(guard.canActivate(context)).toBe(true);
  });
});
