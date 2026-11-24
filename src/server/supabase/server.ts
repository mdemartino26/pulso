import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";
import { sessionCookieOptions } from "./cookie-options";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Usa la clave publishable + la sesión del usuario: todas las
 * consultas pasan por RLS como ese usuario.
 *
 * Se crea uno nuevo por request (nunca compartir entre usuarios).
 */
export async function createSupabaseServerClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, { ...options, ...sessionCookieOptions });
          }
        } catch {
          // Los Server Components no pueden escribir cookies. No pasa nada:
          // proxy.ts ya refrescó la sesión antes de renderizar.
        }
      },
    },
  });
}
