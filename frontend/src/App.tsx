import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { Login } from "./pages/Login";
import { useSessionStore } from "./stores/session";
import type { Rol } from "./stores/session";
import { Paquetes } from "./pages/Paquetes";

function rutaInicial(rol: Rol) {
  return rol === "cliente" ? "/paquetes" : "/reservaciones";
}

function Protegida({ roles }: { roles: Rol[] }) {
  const { token, usuario, expiresAt, cerrarSesion } = useSessionStore();

  useEffect(() => {
    if (!token) return;

    const tiempoRestante = expiresAt - Date.now();

    if (tiempoRestante <= 0) {
      cerrarSesion();
      return;
    }

    const timer = window.setTimeout(cerrarSesion, tiempoRestante);

    function comprobarVencimiento() {
      if (useSessionStore.getState().expiresAt <= Date.now()) {
        cerrarSesion();
      }
    }

    window.addEventListener("focus", comprobarVencimiento);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", comprobarVencimiento);
    };
  }, [token, expiresAt, cerrarSesion]);

  if (!token || !usuario) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(usuario.rol)) {
    return (
      <p role="alert" className="p-6 text-red-800">
        No tienes permiso para acceder a esta página.
      </p>
    );
  }

  return <Outlet />;
}

function Entrada() {
  const { token, usuario } = useSessionStore();

  return (
    <Navigate
      to={token && usuario ? rutaInicial(usuario.rol) : "/login"}
      replace
    />
  );
}

function Layout() {
  const { usuario, cerrarSesion } = useSessionStore();

  return (
    <>
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
          <span className="text-xl font-bold text-brand-900">Viajes Lili</span>

          <nav aria-label="Principal" className="flex gap-4">
            <NavLink
              to="/paquetes"
              className={({ isActive }) =>
                isActive ? "font-semibold text-brand-700 underline" : ""
              }
            >
              Paquetes
            </NavLink>

            <NavLink
              to="/reservaciones"
              className={({ isActive }) =>
                isActive ? "font-semibold text-brand-700 underline" : ""
              }
            >
              {usuario?.rol === "cliente"
                ? "Mis reservaciones"
                : "Reservaciones"}
            </NavLink>
          </nav>

          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <span className="text-sm text-slate-600">
              {usuario?.nombre} · {usuario?.rol}
            </span>

            <button
              onClick={cerrarSesion}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </>
  );
}

function PantallaTemporal({ titulo }: { titulo: string }) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="mt-2 text-slate-600">
        Conectaremos los datos en el siguiente bloque.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<Protegida roles={["admin", "agente", "cliente"]} />}>
          <Route element={<Layout />}>
            <Route path="/paquetes" element={<Paquetes />} />

            <Route
              path="/reservaciones"
              element={<PantallaTemporal titulo="Reservaciones" />}
            />
          </Route>
        </Route>

        <Route path="*" element={<Entrada />} />
      </Routes>
    </BrowserRouter>
  );
}
