import type { ProviderFood } from "@/lib/food";

/**
 * Contrato de un proveedor de alimentos. Sumar otro proveedor (por ejemplo,
 * una base argentina) es implementar esta interfaz y registrarlo.
 */
export interface FoodProvider {
  readonly source: ProviderFood["source"];
  search(query: string): Promise<ProviderFood[]>;
  byBarcode(barcode: string): Promise<ProviderFood | null>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Error del proveedor sin detalles internos (se loguea solo el código). */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly code: "timeout" | "http" | "invalid_response" | "network",
    readonly status?: number,
  ) {
    super(`Proveedor ${provider} no disponible (${code})`);
    this.name = "ProviderError";
  }
}

/** Timeout corto: si el proveedor tarda, mostramos lo que tengamos en caché. */
export const PROVIDER_TIMEOUT_MS = 6000;

export async function fetchJson(
  fetchFn: FetchLike,
  provider: string,
  url: string,
  init: RequestInit = {},
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      ...init,
      // Nunca seguir redirecciones a otros dominios ni mandar cookies.
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ProviderError(provider, timeout ? "timeout" : "network");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ProviderError(provider, "http", res.status);
  // Límite de tamaño: una respuesta gigante no debe tumbar el servidor.
  const text = await res.text();
  if (text.length > 2_000_000) throw new ProviderError(provider, "invalid_response");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError(provider, "invalid_response");
  }
}
