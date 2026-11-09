import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useSessionStore } from "../stores/session";
import type { LoginResponse } from "../stores/session";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Escribe un correo válido.")
    .max(254, "El correo es demasiado largo."),
  password: z
    .string()
    .min(1, "Escribe tu contraseña.")
    .max(128, "La contraseña es demasiado larga."),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const iniciarSesion = useSessionStore((state) => state.iniciarSesion);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(datos: LoginForm) {
    setError("");

    try {
      const response = await api<LoginResponse>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(datos),
        },
        false,
      );

      iniciarSesion(response);

      navigate(
        response.usuario.rol === "cliente" ? "/paquetes" : "/reservaciones",
        { replace: true },
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-5 sm:px-8">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-xl bg-brand-700 text-2xl text-white"
          >
            ✈
          </span>

          <div>
            <p className="text-xl font-bold tracking-tight text-brand-900">
              Viajes Lili
            </p>
            <p className="text-xs tracking-wide text-slate-500">
              Tu próximo destino comienza aquí
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center px-4 py-8 sm:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-brand-900/5">
          <section
            aria-labelledby="login-title"
            className="px-6 py-9 sm:px-9 sm:py-10"
          >
            <p className="text-sm font-semibold text-brand-700">
              Bienvenido a Viajes Lili
            </p>

            <h1
              id="login-title"
              className="mt-2 text-3xl font-bold tracking-tight text-brand-900"
            >
              Iniciar sesión
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Ingresa a tu cuenta para consultar paquetes y administrar
              reservaciones.
            </p>

            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="mt-8 space-y-5"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Correo electrónico
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="tu@correo.com"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base placeholder:text-slate-400"
                />

                {errors.email && (
                  <p id="email-error" className="mt-2 text-sm text-red-700">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold"
                >
                  Contraseña
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base placeholder:text-slate-400"
                />

                {errors.password && (
                  <p id="password-error" className="mt-2 text-sm text-red-700">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-12 w-full rounded-lg bg-accent-500 px-4 py-3 font-bold text-brand-900 transition-colors hover:bg-orange-300"
              >
                {isSubmitting ? "Ingresando…" : "Iniciar sesión"}
              </button>
            </form>
          </section>
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-slate-500">
        Viajes Lili · Sistema de reservaciones
      </footer>
    </div>
  );
}
