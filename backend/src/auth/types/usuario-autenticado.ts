import { RolUsuario } from 'src/usuarios/usuario.entity';
import type { Request } from 'express';
export interface UsuarioAutenticado {
  id: string;
  rol: RolUsuario;
}

export interface RequestAutenticada extends Request {
  user: UsuarioAutenticado;
}
