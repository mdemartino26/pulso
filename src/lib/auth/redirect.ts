/**
 * Valida el parámetro `next` (a dónde volver después del login).
 *
 * Solo se aceptan rutas internas ("/algo"). Cualquier otra cosa
 * ("https://malo.com", "//malo.com", "/\malo.com", "javascript:...") vuelve
 * a "/". Esto evita un "open redirect": que alguien arme un link de login
 * de Pulso que, después de iniciar sesión, mande al usuario a un sitio falso.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || next.length > 512) return fallback;
  if (!next.startsWith("/")) return fallback;
  // "//dominio" y "/\dominio" los navegadores los toman como otro sitio.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Sin caracteres de control (saltos de línea, tabs) ni barras invertidas.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;

  try {
    // Si al resolverla contra un origen ficticio cambia de origen, no es interna.
    const url = new URL(next, "http://pulso.invalid");
    if (url.origin !== "http://pulso.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
