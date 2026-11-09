import { useEffect, useState } from "react";
import { usePaquetesStore } from "../stores/paquetes";
import { useSessionStore } from "../stores/session";
import { FiltrosPaquetes } from "../components/FiltrosPaquetes";
import { filtrosIniciales } from "../stores/paquetes";
import type { FiltrosPaquetes as DatosFiltros } from "../stores/paquetes";

const moneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function mostrarFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${fecha}T12:00:00`));
}

export function Paquetes() {
  const [page, setPage] = useState(1);
  const [intento, setIntento] = useState(0);
  const [filtros, setFiltros] = useState<DatosFiltros>(filtrosIniciales);

  const token = useSessionStore((state) => state.token);

  const { items, total, totalPages, cargando, error, cargar } =
    usePaquetesStore();

  useEffect(() => {
    const controller = new AbortController();

    void cargar(page, filtros, controller.signal);

    return () => controller.abort();
  }, [page, filtros, intento, token, cargar]);

  function buscar(datos: DatosFiltros) {
    setFiltros(datos);
    setPage(1);
  }

  return (
    <section>
      <div className="mb-8 rounded-2xl bg-brand-900 px-6 py-8 text-white sm:px-9">
        <p className="text-sm font-semibold text-brand-100">
          Descubre tu próximo destino
        </p>

        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Paquetes de viaje
        </h1>

        <p className="mt-3 text-brand-50">
          Consulta fechas, precios por persona y lugares disponibles.
        </p>
      </div>

      <FiltrosPaquetes onBuscar={buscar} />

      {cargando ? (
        <p role="status" className="py-12 text-center text-slate-600">
          Cargando paquetes…
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
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">No encontramos paquetes</h2>

          <p className="mt-2 text-slate-500">
            No hay resultados para esta página.
          </p>

          {page > 1 && (
            <button
              onClick={() => setPage(1)}
              className="mt-4 font-semibold text-brand-700 underline"
            >
              Volver a la primera página
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {total}{" "}
            {total === 1 ? "paquete encontrado" : "paquetes encontrados"}
          </p>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((paquete) => (
              <article
                key={paquete.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {paquete.cupoDisponible > 0
                    ? "Con disponibilidad"
                    : "Sin cupo"}
                </span>

                <h2 className="mt-4 text-xl font-bold text-brand-900">
                  {paquete.destino}
                </h2>

                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Salida</dt>
                    <dd className="font-medium">
                      {mostrarFecha(paquete.fechaInicio)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-slate-500">Regreso</dt>
                    <dd className="font-medium">
                      {mostrarFecha(paquete.fechaFin)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-slate-500">Lugares disponibles</dt>
                    <dd className="font-medium">{paquete.cupoDisponible}</dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">Precio por persona</p>

                  <p className="mt-1 text-2xl font-bold text-brand-700">
                    {moneda.format(Number(paquete.precio))}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <nav
            aria-label="Paginación de paquetes"
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
              Página {page} de {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((actual) => actual + 1)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2"
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
