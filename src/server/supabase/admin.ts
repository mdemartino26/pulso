import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/server/db/database.types";

/**
 * Cliente con la clave SECRETA de Supabase: saltea RLS.
 *
 * Por qué existe: la caché de alimentos (foods_cache, food_search_cache) es
 * compartida entre usuarios. Si cada usuario pudiera escribirla, uno podría
 * "envenenarla" con datos falsos para todos. Por eso solo el servidor
 * escribe, después de validar lo que devolvió USDA / Open Food Facts.
 * (En la Etapa 9 se usa también para borrar la cuenta.)
 *
 * Reglas:
 * - "server-only": el build falla si un componente de cliente lo importa.
 * - ESLint solo permite importarlo desde los archivos de la lista en
 *   eslint.config.mjs.
 * - Nunca se usa con datos que mande el usuario sin validar.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const { SUPABASE_SECRET_KEY } = getServerEnv();
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
