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
}

/** Imágenes de productos de Open Food Facts (se muestran directo, sin proxy). */
const OPEN_FOOD_FACTS_IMAGES = "https://images.openfoodfacts.org";

export function buildCsp({ nonce, isDev }: CspOptions): string {
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
    // El navegador solo habla con nuestra app. Supabase, USDA y Open Food
    // Facts se consultan desde el servidor (las cookies de sesión son
    // httpOnly, así que el navegador ni siquiera tiene los tokens).
    "connect-src": ["'self'"],
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
