/** Rutas a las que se puede entrar sin sesión. */
export const AUTH_PAGES = ["/login", "/registro", "/recuperar-contrasena"] as const;

const PUBLIC_PREFIXES = ["/auth/"] as const;
const PUBLIC_EXACT = new Set<string>([...AUTH_PAGES, "/manifest.webmanifest"]);

export const LOGIN_PATH = "/login";
export const HOME_PATH = "/";

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Páginas de login/registro: con sesión iniciada no tiene sentido verlas. */
export function isAuthPage(pathname: string): boolean {
  return (AUTH_PAGES as readonly string[]).includes(pathname);
}
