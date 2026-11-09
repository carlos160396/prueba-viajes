import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { filtrosIniciales } from "../stores/paquetes";
import type { FiltrosPaquetes as DatosFiltros } from "../stores/paquetes";

const fechaOpcional = z.union([
  z.literal(""),
  z.iso.date("Escribe una fecha válida."),
]);

const schema = z
  .object({
    destino: z
      .string()
      .trim()
      .max(150, "El destino debe tener máximo 150 caracteres."),
    fechaDesde: fechaOpcional,
    fechaHasta: fechaOpcional,
    precioMax: z
      .string()
      .trim()
      .refine(
        (valor) => valor === "" || /^\d{1,10}(\.\d{1,2})?$/.test(valor),
        "Escribe un precio no negativo con máximo 2 decimales.",
      ),
  })
  .refine(
    (datos) =>
      !datos.fechaDesde ||
      !datos.fechaHasta ||
      datos.fechaDesde <= datos.fechaHasta,
    {
      message: "La fecha final debe ser igual o posterior a la inicial.",
      path: ["fechaHasta"],
    },
  );

interface Props {
  onBuscar: (datos: DatosFiltros) => void;
}

const campos = [
  {
    nombre: "destino",
    label: "Destino",
    tipo: "text",
    placeholder: "Ej. Cancún",
  },
  {
    nombre: "fechaDesde",
    label: "Salida desde",
    tipo: "date",
  },
  {
    nombre: "fechaHasta",
    label: "Regreso hasta",
    tipo: "date",
  },
  {
    nombre: "precioMax",
    label: "Precio máximo por persona",
    tipo: "text",
    placeholder: "Ej. 8000.00",
  },
] as const;

export function FiltrosPaquetes({ onBuscar }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DatosFiltros>({
    resolver: zodResolver(schema),
    defaultValues: filtrosIniciales,
  });

  function limpiar() {
    reset(filtrosIniciales);
    onBuscar({ ...filtrosIniciales });
  }

  return (
    <form
      onSubmit={handleSubmit(onBuscar)}
      noValidate
      aria-label="Filtros de paquetes"
      className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {campos.map((campo) => (
          <div key={campo.nombre}>
            <label
              htmlFor={campo.nombre}
              className="mb-2 block text-sm font-semibold"
            >
              {campo.label}
            </label>

            <input
              id={campo.nombre}
              type={campo.tipo}
              placeholder={
                "placeholder" in campo ? campo.placeholder : undefined
              }
              inputMode={campo.nombre === "precioMax" ? "decimal" : undefined}
              {...register(campo.nombre)}
              aria-invalid={!!errors[campo.nombre]}
              aria-describedby={
                errors[campo.nombre] ? `${campo.nombre}-error` : undefined
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />

            {errors[campo.nombre] && (
              <p
                id={`${campo.nombre}-error`}
                className="mt-1 text-sm text-red-700"
              >
                {errors[campo.nombre]?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-lg bg-accent-500 px-6 py-3 font-semibold text-brand-900 hover:bg-orange-300"
        >
          Buscar paquetes
        </button>

        <button
          type="button"
          onClick={limpiar}
          className="rounded-lg border border-slate-300 px-5 py-3"
        >
          Limpiar filtros
        </button>
      </div>
    </form>
  );
}
