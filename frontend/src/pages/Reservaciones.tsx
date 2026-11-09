import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useSessionStore } from "../stores/session";
import { AccionesReservacion } from "../components/AccionesReservacion";

type EstadoPago = "PENDIENTE" | "PAGADA" | "CANCELADA";

interface Reservacion {
  id: string;
  clienteId: string;
  paqueteId: string;
  numeroPersonas: number;
  precioUnitario: string;
  total: string;
  estadoPago: EstadoPago;
  createdAt: string;
  paquete: {
    destino: string;
    fechaInicio: string;
    fechaFin: string;
  } | null;
}

interface ListadoReservaciones {
  items: Reservacion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const moneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const estilosEstado: Record<EstadoPago, string> = {
  PENDIENTE: "bg-amber-50 text-amber-800",
  PAGADA: "bg-emerald-50 text-emerald-800",
  CANCELADA: "bg-slate-100 text-slate-700",
};

function mostrarFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${fecha}T12:00:00`));
}

export function Reservaciones() {
  const usuario = useSessionStore((state) => state.usuario);
  const token = useSessionStore((state) => state.token);
  const esCliente = usuario?.rol === "cliente";

  const [page, setPage] = useState(1);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<ListadoReservaciones | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function consultar() {
      setCargando(true);
      setError("");
      setResultado(null);

      try {
        const response = await api<ListadoReservaciones>(
          `/reservaciones?page=${page}&limit=10`,
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          setResultado(response);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "No se pudieron consultar las reservaciones.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void consultar();

    return () => controller.abort();
  }, [page, intento, token]);

  return (
    <section>
      <div className="mb-8">
        <p className="text-sm font-semibold text-brand-700">Viajes Lili</p>

        <h1 className="mt-2 text-3xl font-bold text-brand-900">
          {esCliente ? "Mis reservaciones" : "Reservaciones"}
        </h1>

        <p className="mt-3 text-slate-500">
          {esCliente
            ? "Consulta tus viajes y su estado de pago."
            : "Consulta las reservaciones de los clientes y su estado de pago."}
        </p>
      </div>

      {cargando ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Cargando reservaciones…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5"
        >
          <p className="text-red-800">{error}</p>

          <button
            onClick={() => setIntento((actual) => actual + 1)}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-red-800"
          >
            Reintentar
          </button>
        </div>
      ) : resultado && resultado.items.length > 0 ? (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {resultado.total}{" "}
            {resultado.total === 1
              ? "reservación encontrada"
              : "reservaciones encontradas"}
          </p>

          <div className="space-y-4">
            {resultado.items.map((reservacion) => (
              <article
                key={reservacion.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-brand-900">
                      {reservacion.paquete?.destino ?? "Paquete no disponible"}
                    </h2>

                    <p className="mt-1 break-all text-xs text-slate-500">
                      Folio: {reservacion.id}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      estilosEstado[reservacion.estadoPago]
                    }`}
                  >
                    {reservacion.estadoPago}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-sm text-slate-500">Salida</dt>
                    <dd className="mt-1 font-medium">
                      {reservacion.paquete
                        ? mostrarFecha(reservacion.paquete.fechaInicio)
                        : "No disponible"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">Regreso</dt>
                    <dd className="mt-1 font-medium">
                      {reservacion.paquete
                        ? mostrarFecha(reservacion.paquete.fechaFin)
                        : "No disponible"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">Personas</dt>
                    <dd className="mt-1 font-medium">
                      {reservacion.numeroPersonas}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">Total</dt>
                    <dd className="mt-1 text-xl font-bold text-brand-700">
                      {moneda.format(Number(reservacion.total))}
                    </dd>
                  </div>
                </dl>

                {!esCliente && (
                  <p className="mt-5 break-all border-t border-slate-100 pt-4 text-xs text-slate-500">
                    Cliente: {reservacion.clienteId}
                  </p>
                )}

                {usuario?.rol === "agente" && (
                  <AccionesReservacion
                    reservacionId={reservacion.id}
                    estadoPago={reservacion.estadoPago}
                    onActualizar={() => setIntento((actual) => actual + 1)}
                  />
                )}
              </article>
            ))}
          </div>

          <nav
            aria-label="Paginación de reservaciones"
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <button
              disabled={page <= 1}
              onClick={() => setPage((actual) => actual - 1)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2"
            >
              Anterior
            </button>

            <span className="text-sm text-slate-600">
              Página {page} de {resultado.totalPages}
            </span>

            <button
              disabled={page >= resultado.totalPages}
              onClick={() => setPage((actual) => actual + 1)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2"
            >
              Siguiente
            </button>
          </nav>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">
            {esCliente
              ? "Todavía no tienes reservaciones en esta página"
              : "No hay reservaciones en esta página"}
          </h2>

          {page > 1 ? (
            <button
              onClick={() => setPage(1)}
              className="mt-4 font-semibold text-brand-700 underline"
            >
              Volver a la primera página
            </button>
          ) : (
            <Link
              to="/paquetes"
              className="mt-4 inline-block font-semibold text-brand-700 underline"
            >
              Explorar paquetes
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
