import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Usuario actual, verificado. `getClaims()` valida la firma del JWT (no
 * confía ciegamente en la cookie, como haría `getSession()`).
 * `cache` evita repetir la verificación dentro del mismo request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

/**
 * Para páginas y acciones privadas. proxy.ts ya redirige, pero cada página
 * vuelve a verificar: el proxy es una comodidad, no la única barrera.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
