import "server-only";
import { z } from "zod";

/**
 * Variables SECRETAS. El import de "server-only" hace que el build falle
 * si algún componente de cliente importa este archivo por error.
 */
const serverEnvSchema = z.object({
  // API key de USDA FoodData Central. Solo la usan los Route Handlers.
  USDA_API_KEY: z.string().min(10),
  // Clave secreta de Supabase (la antigua service_role). Saltea RLS.
  // Se usa ÚNICAMENTE en src/server/supabase/admin.ts (Etapa 5 y 9).
  SUPABASE_SECRET_KEY: z.string().min(20),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    USDA_API_KEY: process.env.USDA_API_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variables de entorno del servidor inválidas o faltantes: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
