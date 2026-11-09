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

export interface FiltrosPaquetes {
  destino: string;
  fechaDesde: string;
  fechaHasta: string;
  precioMax: string;
}

export const filtrosIniciales: FiltrosPaquetes = {
  destino: "",
  fechaDesde: "",
  fechaHasta: "",
  precioMax: "",
};

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
  cargar: (
    page: number,
    filtros: FiltrosPaquetes,
    signal: AbortSignal,
  ) => Promise<void>;
}

export const usePaquetesStore = create<PaquetesState>((set) => ({
  items: [],
  total: 0,
  totalPages: 0,
  cargando: false,
  error: null,

  cargar: async (page, filtros, signal) => {
    set({
      cargando: true,
      error: null,
      items: [],
      total: 0,
      totalPages: 0,
    });

    const params = new URLSearchParams({
      page: String(page),
      limit: "6",
    });

    for (const [campo, valor] of Object.entries(filtros)) {
      if (valor !== "") {
        params.set(campo, valor);
      }
    }

    try {
      const response = await api<ListadoPaquetes>(
        `/paquetes?${params.toString()}`,
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
