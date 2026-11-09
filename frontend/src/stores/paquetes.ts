import { create } from "zustand";
import { api } from "../lib/api";

export interface Paquete {
  id: string;
  destino: string;
  fechaInicio: string;
  fechaFin: string;
  precio: string;
  cupoTotal: number;
  cupoDisponible: number;
  activo: boolean;
}

interface ListadoPaquetes {
  items: Paquete[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaquetesState {
  items: Paquete[];
  total: number;
  totalPages: number;
  cargando: boolean;
  error: string | null;
  cargar: (page: number, signal: AbortSignal) => Promise<void>;
}

export const usePaquetesStore = create<PaquetesState>((set) => ({
  items: [],
  total: 0,
  totalPages: 0,
  cargando: false,
  error: null,

  cargar: async (page, signal) => {
    set({
      cargando: true,
      error: null,
      items: [],
      total: 0,
      totalPages: 0,
    });

    try {
      const response = await api<ListadoPaquetes>(
        `/paquetes?page=${page}&limit=6`,
        { signal },
      );

      if (signal.aborted) return;

      set({
        items: response.items,
        total: response.total,
        totalPages: response.totalPages,
        cargando: false,
      });
    } catch (error) {
      if (signal.aborted) return;

      set({
        cargando: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los paquetes.",
      });
    }
  },
}));
