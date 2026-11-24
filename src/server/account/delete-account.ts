import "server-only";
import { createAdminClient } from "@/server/supabase/admin";

/**
 * Borra la cuenta de Supabase Auth. Todas las tablas tienen
 * `references auth.users (id) on delete cascade`, así que con esto se borran
 * también TODOS los datos de la persona (perfil, comidas, actividad, peso,
 * agua, hábitos, límites...).
 *
 * Usa la clave secreta porque borrar un usuario de Auth solo se puede con
 * permisos de administrador. Por eso:
 * - el `userId` SIEMPRE viene de la sesión verificada en el servidor, nunca
 *   del formulario;
 * - este archivo es uno de los únicos dos que ESLint deja importar el
 *   cliente admin.
 */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[account] no se pudo borrar la cuenta", { code: error.code ?? error.status ?? "unknown" });
    return false;
  }
  return true;
}
