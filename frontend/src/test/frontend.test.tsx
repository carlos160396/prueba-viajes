import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Login } from "../pages/Login";
import { Paquetes } from "../pages/Paquetes";
import { useSessionStore } from "../stores/session";
import { usePaquetesStore } from "../stores/paquetes";

const fetchMock = vi.fn<typeof fetch>();

function iniciarSesionDePrueba() {
  useSessionStore.getState().iniciarSesion({
    access_token: "token-simulado",
    token_type: "Bearer",
    expires_in: 3600,
    usuario: {
      id: "cliente-prueba",
      nombre: "Cliente de prueba",
      email: "cliente@example.com",
      rol: "cliente",
    },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);

  useSessionStore.getState().cerrarSesion();

  usePaquetesStore.setState({
    items: [],
    total: 0,
    totalPages: 0,
    cargando: false,
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useSessionStore.getState().cerrarSesion();
});

describe("Login", () => {
  it("valida los campos vacíos sin llamar al backend", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Escribe un correo válido."),
    ).toBeInTheDocument();

    expect(screen.getByText("Escribe tu contraseña.")).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Paquetes", () => {
  it("muestra los paquetes recibidos desde la API", async () => {
    iniciarSesionDePrueba();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "paquete-prueba",
              destino: "Cancún",
              fechaInicio: "2026-12-15",
              fechaFin: "2026-12-20",
              precio: "1500.00",
              cupoTotal: 20,
              cupoDisponible: 18,
              activo: true,
            },
          ],
          total: 1,
          page: 1,
          limit: 6,
          totalPages: 1,
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter>
        <Paquetes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Cancún" }),
    ).toBeInTheDocument();

    expect(screen.getByText("18")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Reservar" })).toHaveAttribute(
      "href",
      "/paquetes/paquete-prueba/reservar",
    );

    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("muestra el estado vacío cuando no hay resultados", async () => {
    iniciarSesionDePrueba();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          limit: 6,
          totalPages: 0,
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter>
        <Paquetes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("No encontramos paquetes"),
    ).toBeInTheDocument();
  });

  it("muestra falta de permiso ante 403 sin cerrar la sesión", async () => {
    iniciarSesionDePrueba();

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }),
    );

    render(
      <MemoryRouter>
        <Paquetes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tienes permiso para realizar esta acción.",
    );

    expect(useSessionStore.getState().token).toBe("token-simulado");

    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
