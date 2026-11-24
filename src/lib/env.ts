import { z } from "zod";

/**
 * Variables PÚBLICAS (llegan al navegador). Solo cosas que no son secretas.
 *
 * Next.js reemplaza `process.env.NEXT_PUBLIC_*` en tiempo de build, por eso
 * se leen una por una (no se puede pasar `process.env` entero).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Clave "publishable" de Supabase (la antigua anon key). Es pública por
  // diseño: lo que protege los datos es RLS, no esta clave.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    // Solo nombres de variables, nunca valores.
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variables de entorno públicas inválidas o faltantes: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
