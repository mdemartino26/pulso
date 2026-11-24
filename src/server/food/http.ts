import "server-only";
import { NextResponse } from "next/server";
import type { Result, ServiceError } from "@/server/services/food-service";

/** Respuestas JSON de la API de alimentos: sin caché compartida y sin detalles internos. */
const HEADERS = { "Cache-Control": "private, no-store" };

const STATUS: Record<ServiceError, number> = {
  invalid_input: 400,
  rate_limited: 429,
  not_found: 404,
  unavailable: 503,
  unit_not_available: 400,
  date_out_of_range: 400,
};

const MESSAGES: Record<ServiceError, string> = {
  invalid_input: "Revisá lo que escribiste.",
  rate_limited: "Estás buscando muy rápido. Esperá un minuto y probá de nuevo.",
  not_found: "No encontramos ese producto.",
  unavailable: "Las bases de alimentos no responden ahora. Probá en un rato o cargalo a mano.",
  unit_not_available: "Esa unidad no está disponible para este alimento.",
  date_out_of_range: "Esa fecha no está disponible.",
};

export function jsonResult<T>(result: Result<T>) {
  if (result.ok) return NextResponse.json(result.value, { headers: HEADERS });
  const headers = result.code === "rate_limited" ? { ...HEADERS, "Retry-After": "60" } : HEADERS;
  return NextResponse.json({ error: result.code, message: MESSAGES[result.code] }, { status: STATUS[result.code], headers });
}

export function jsonError(status: 401 | 500) {
  const message = status === 401 ? "Tu sesión venció. Volvé a entrar." : "Algo salió mal. Probá de nuevo.";
  return NextResponse.json({ error: status === 401 ? "unauthorized" : "server_error", message }, { status, headers: HEADERS });
}

/** Ejecuta el handler y convierte cualquier excepción en un 500 genérico. */
export async function safely(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    // El detalle ya quedó en el log (RepositoryError / ProviderError) con solo códigos.
    console.error("[api/foods] error inesperado", e instanceof Error ? e.name : "unknown");
    return jsonError(500);
  }
}
