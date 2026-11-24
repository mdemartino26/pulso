import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Opciones de las cookies de sesión.
 *
 * httpOnly: true → JavaScript del navegador NO puede leer los tokens. Si
 * algún día se colara un XSS, no podría robar la sesión. Es posible porque
 * en Pulso el navegador nunca habla con Supabase: todo pasa por el servidor
 * (Server Components, Server Actions y Route Handlers).
 *
 * secure: solo por HTTPS (en local, http://localhost, queda en false).
 * sameSite "lax": la cookie no viaja en POST desde otros sitios (CSRF) pero
 * sí al volver de Google o de un link del mail.
 */
export const sessionCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
