import { useSessionStore } from "../stores/session";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ErrorResponse {
  message?: string | string[];
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  protegida = true,
): Promise<T> {
  const session = useSessionStore.getState();

  if (protegida && (!session.token || session.expiresAt <= Date.now())) {
    session.cerrarSesion();

    throw new ApiError(401, "Tu sesión expiró. Inicia sesión nuevamente.");
  }

  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (protegida) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      0,
      "No se pudo conectar con el servidor. Intenta nuevamente.",
    );
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      protegida &&
      useSessionStore.getState().token === session.token
    ) {
      session.cerrarSesion();
    }

    const mensajes: Record<number, string> = {
      401: protegida
        ? "Tu sesión expiró. Inicia sesión nuevamente."
        : "Correo o contraseña incorrectos.",
      403: "No tienes permiso para realizar esta acción.",
      409: "La operación entra en conflicto con la información actual. Actualiza e intenta nuevamente.",
      429: "Demasiados intentos. Espera un minuto antes de intentar nuevamente.",
    };

    const body: ErrorResponse | null = await response.json().catch(() => null);

    const detalle = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;

    const mensaje =
      mensajes[response.status] ??
      (response.status >= 500
        ? "Ocurrió un error en el servidor. Intenta nuevamente."
        : detalle || "No se pudo completar la solicitud.");

    throw new ApiError(response.status, mensaje);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
