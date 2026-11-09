import { useState } from "react";
import { api, ApiError } from "../lib/api";

type EstadoPago = "PENDIENTE" | "PAGADA" | "CANCELADA";
type NuevoEstado = "PAGADA" | "CANCELADA";

interface Props {
  reservacionId: string;
  estadoPago: EstadoPago;
  onActualizar: () => void;
}

export function AccionesReservacion({
  reservacionId,
  estadoPago,
  onActualizar,
}: Props) {
  const [guardando, setGuardando] = useState(false);
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false);
  const [error, setError] = useState("");
  const [conflicto, setConflicto] = useState(false);

  async function cambiarEstado(nuevoEstado: NuevoEstado) {
    if (guardando) return;

    setGuardando(true);
    setError("");
    setConflicto(false);

    try {
      await api<unknown>(`/reservaciones/${reservacionId}/estado`, {
        method: "PATCH",
        body: JSON.stringify({
          estadoPago: nuevoEstado,
        }),
      });

      onActualizar();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflicto(true);
        setError(
          "La reservación cambió o la transición ya no está permitida. Actualiza el listado antes de continuar.",
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el estado.",
        );
      }
    } finally {
      setGuardando(false);
      setConfirmarCancelacion(false);
    }
  }

  if (estadoPago === "CANCELADA") return null;

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {guardando && (
        <p role="status" className="mb-3 text-sm text-slate-600">
          Actualizando estado…
        </p>
      )}

      {conflicto ? (
        <button
          type="button"
          onClick={onActualizar}
          className="rounded-lg border border-slate-300 px-4 py-2"
        >
          Actualizar listado
        </button>
      ) : confirmarCancelacion ? (
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            ¿Cancelar esta reservación? Se devolverán los lugares al paquete.
            Esta acción no realiza un reembolso.
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={guardando}
              onClick={() => void cambiarEstado("CANCELADA")}
              className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white"
            >
              Confirmar cancelación
            </button>

            <button
              type="button"
              disabled={guardando}
              onClick={() => setConfirmarCancelacion(false)}
              className="rounded-lg border border-slate-300 px-4 py-2"
            >
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {estadoPago === "PENDIENTE" && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => void cambiarEstado("PAGADA")}
              className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white"
            >
              Marcar como pagada
            </button>
          )}

          <button
            type="button"
            disabled={guardando}
            onClick={() => setConfirmarCancelacion(true)}
            className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700"
          >
            Cancelar reservación
          </button>
        </div>
      )}
    </div>
  );
}
