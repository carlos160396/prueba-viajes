import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "../lib/api";
import { useSessionStore } from "../stores/session";
import type { Paquete } from "../stores/paquetes";

const schema = z.object({
  numeroPersonas: z
    .number("Escribe un número válido.")
    .int("Debe ser un número entero.")
    .min(1, "Debes reservar al menos un lugar.")
    .max(2147483647, "El número es demasiado grande."),
  clienteId: z.union([
    z.literal(""),
    z.string().uuid("Escribe un UUID de cliente válido."),
  ]),
});

type DatosFormulario = z.infer<typeof schema>;

interface ReservaCreada {
  id: string;
  total: string;
  estadoPago: "PENDIENTE" | "PAGADA" | "CANCELADA";
}

const moneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function CrearReservacion() {
  const { paqueteId } = useParams();
  const usuario = useSessionStore((state) => state.usuario);
  const esAgente = usuario?.rol === "agente";

  const [paquete, setPaquete] = useState<Paquete | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [reserva, setReserva] = useState<ReservaCreada | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError: setErrorCampo,
    formState: { errors, isSubmitting },
  } = useForm<DatosFormulario>({
    resolver: zodResolver(schema),
    defaultValues: {
      numeroPersonas: 1,
      clienteId: "",
    },
  });

  const numeroPersonas = watch("numeroPersonas");

  useEffect(() => {
    const controller = new AbortController();

    async function consultarPaquete() {
      setCargando(true);
      setPaquete(null);

      try {
        const response = await api<Paquete>(`/paquetes/${paqueteId}`, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setPaquete(response);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "No se pudo consultar el paquete.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void consultarPaquete();

    return () => controller.abort();
  }, [paqueteId, intento]);

  async function onSubmit(datos: DatosFormulario) {
    if (!paquete) return;

    setError("");

    if (esAgente && !datos.clienteId) {
      setErrorCampo("clienteId", {
        message: "Indica el UUID del cliente.",
      });
      return;
    }

    if (datos.numeroPersonas > paquete.cupoDisponible) {
      setErrorCampo("numeroPersonas", {
        message: `Solo hay ${paquete.cupoDisponible} lugares disponibles.`,
      });
      return;
    }

    const body = {
      paqueteId: paquete.id,
      numeroPersonas: datos.numeroPersonas,
      ...(esAgente ? { clienteId: datos.clienteId } : {}),
    };

    try {
      const response = await api<ReservaCreada>("/reservaciones", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setReserva(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError(
          "No se pudo confirmar el cupo solicitado. Actualizamos la disponibilidad; revísala antes de intentar nuevamente.",
        );
        setIntento((actual) => actual + 1);
        return;
      }

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo crear la reservación.",
      );
    }
  }

  const totalVistaPrevia =
    paquete &&
    Number.isInteger(numeroPersonas) &&
    numeroPersonas > 0 &&
    numeroPersonas <= paquete.cupoDisponible
      ? Number(paquete.precio) * numeroPersonas
      : null;

  if (reserva) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-brand-100 bg-white p-6">
        <h1 className="text-2xl font-bold text-brand-900">
          Reservación creada
        </h1>

        <dl className="mt-5 space-y-3">
          <div>
            <dt className="text-sm text-slate-500">Folio</dt>
            <dd className="break-all font-medium">{reserva.id}</dd>
          </div>

          <div>
            <dt className="text-sm text-slate-500">Total confirmado</dt>
            <dd className="text-2xl font-bold text-brand-700">
              {moneda.format(Number(reserva.total))}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-slate-500">Estado</dt>
            <dd className="font-medium">{reserva.estadoPago}</dd>
          </div>
        </dl>

        <Link
          to="/reservaciones"
          className="mt-6 inline-block font-semibold text-brand-700 underline"
        >
          Ver reservaciones
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl">
      <Link to="/paquetes" className="text-sm text-brand-700 underline">
        Volver a paquetes
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-brand-900">
        Crear reservación
      </h1>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}

      {cargando ? (
        <p role="status" className="mt-6">
          Consultando disponibilidad…
        </p>
      ) : !paquete ? (
        <button
          onClick={() => {
            setError("");
            setIntento((actual) => actual + 1);
          }}
          className="mt-5 rounded-lg border px-4 py-2"
        >
          Reintentar
        </button>
      ) : (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">{paquete.destino}</h2>

          <p className="mt-2 text-sm text-slate-500">
            {paquete.cupoDisponible} lugares disponibles ·{" "}
            {moneda.format(Number(paquete.precio))} por persona
          </p>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="mt-6 space-y-5"
          >
            {esAgente && (
              <div>
                <label
                  htmlFor="clienteId"
                  className="mb-2 block text-sm font-semibold"
                >
                  UUID del cliente
                </label>

                <input
                  id="clienteId"
                  {...register("clienteId")}
                  aria-invalid={!!errors.clienteId}
                  aria-describedby="clienteId-ayuda"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />

                <p id="clienteId-ayuda" className="mt-1 text-sm text-slate-500">
                  Identificador del cliente para quien haces la reservación.
                </p>

                {errors.clienteId && (
                  <p role="alert" className="mt-1 text-sm text-red-700">
                    {errors.clienteId.message}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="numeroPersonas"
                className="mb-2 block text-sm font-semibold"
              >
                Número de personas
              </label>

              <input
                id="numeroPersonas"
                type="number"
                min="1"
                max={paquete.cupoDisponible}
                step="1"
                {...register("numeroPersonas", { valueAsNumber: true })}
                aria-invalid={!!errors.numeroPersonas}
                aria-describedby={
                  errors.numeroPersonas ? "personas-error" : undefined
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />

              {errors.numeroPersonas && (
                <p id="personas-error" className="mt-1 text-sm text-red-700">
                  {errors.numeroPersonas.message}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-brand-50 p-4">
              <p className="text-sm text-slate-600">Total estimado</p>

              <p
                aria-live="polite"
                className="mt-1 text-3xl font-bold text-brand-700"
              >
                {totalVistaPrevia === null
                  ? "—"
                  : moneda.format(totalVistaPrevia)}
              </p>

              <p className="mt-2 text-xs text-slate-600">
                El precio y el cupo se confirman al crear la reservación.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting || !paquete.activo || paquete.cupoDisponible === 0
              }
              className="w-full rounded-lg bg-accent-500 px-5 py-3 font-bold text-brand-900"
            >
              {isSubmitting ? "Creando reservación…" : "Confirmar reservación"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
