/**
 * Construcción de la Content-Security-Policy.
 *
 * Función pura (sin dependencias de Next ni de Node) para poder testearla
 * con Vitest. La usa `src/proxy.ts` en cada request.
 */

export interface CspOptions {
  /** Nonce aleatorio, distinto en cada request. */
  nonce: string;
  /** true en `next dev`: React necesita eval y estilos inline para depurar. */
  isDev: boolean;
  /** URL del proyecto de Supabase (NEXT_PUBLIC_SUPABASE_URL). */
  supabaseUrl?: string | undefined;
}

/** Imágenes de productos de Open Food Facts (se muestran directo, sin proxy). */
const OPEN_FOOD_FACTS_IMAGES = "https://images.openfoodfacts.org";

/**
 * Devuelve el origen (https://xxxx.supabase.co) de una URL, o null si
 * la URL no es válida o no es https (salvo localhost para Supabase local).
 */
export function safeOrigin(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const isLocal =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabase = safeOrigin(supabaseUrl);
  const supabaseHttp = supabase ? supabase.origin : null;
  const supabaseWs = supabase
    ? `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`
    : null;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': solo corren los scripts con nonce y los que esos
    // scripts carguen. En dev, React usa eval para reconstruir stacks.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // En dev Next inyecta <style> sin nonce (HMR). En producción, solo nonce.
    "style-src": isDev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`],
    // Atributos style="..." (next/image, Recharts). No pueden ejecutar JS.
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", OPEN_FOOD_FACTS_IMAGES],
    "font-src": ["'self'"],
    // El navegador solo habla con nuestra app y con Supabase (auth + datos).
    // USDA y Open Food Facts se consultan desde nuestros Route Handlers.
    "connect-src": ["'self'", ...(supabaseHttp ? [supabaseHttp] : []), ...(supabaseWs ? [supabaseWs] : [])],
    // Necesario para el service worker: con 'strict-dynamic', 'self' se
    // ignora en script-src, así que worker-src tiene que declararse aparte.
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'", "blob:"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(" ")}`,
  );

  // En localhost (http) upgrade-insecure-requests rompe Safari.
  if (!isDev) parts.push("upgrade-insecure-requests");

  return parts.join("; ");
}

/** Nonce de 128 bits en base64, generado con la Web Crypto API. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
