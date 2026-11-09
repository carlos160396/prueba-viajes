import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Rol = "admin" | "agente" | "cliente";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  usuario: Usuario;
}

interface SessionState {
  token: string | null;
  usuario: Usuario | null;
  expiresAt: number;
  iniciarSesion: (response: LoginResponse) => void;
  cerrarSesion: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      expiresAt: 0,

      iniciarSesion: (response) => {
        set({
          token: response.access_token,
          usuario: response.usuario,
          expiresAt: Date.now() + response.expires_in * 1000,
        });
      },

      cerrarSesion: () => {
        set({
          token: null,
          usuario: null,
          expiresAt: 0,
        });
      },
    }),
    {
      name: "viajes-lili-session",
      partialize: (state) => ({
        token: state.token,
        usuario: state.usuario,
        expiresAt: state.expiresAt,
      }),
    },
  ),
);
