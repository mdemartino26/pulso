"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/features/auth/form-state";
import { deleteAccountSchema } from "@/lib/validation/account";
import { deleteAuthUser } from "@/server/account/delete-account";
import { requireUser } from "@/server/auth/session";
import { signOut } from "@/server/services/auth-service";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Borrar la cuenta. Es irreversible, así que:
 * - se pide escribir BORRAR (evita borrados por un toque accidental);
 * - se vuelve a verificar la sesión contra Supabase (`getUser`), no solo la
 *   firma del token, por si la sesión se cerró en otro lado;
 * - el id sale de esa sesión, nunca del formulario.
 */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessionUser = await requireUser();
  const parsed = deleteAccountSchema.safeParse({ confirm: formData.get("confirm") });
  if (!parsed.success) return { status: "error", fieldErrors: { confirm: ["Escribí BORRAR para confirmar"] } };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== sessionUser.id) {
    return { status: "error", message: "Tu sesión venció. Volvé a entrar y probá de nuevo." };
  }

  if (!(await deleteAuthUser(data.user.id))) {
    return { status: "error", message: "No pudimos borrar la cuenta. Probá de nuevo en un rato." };
  }
  // La sesión ya no sirve; igual se borran las cookies de este navegador.
  await signOut().catch(() => {});
  redirect("/login?aviso=cuenta_borrada");
}
