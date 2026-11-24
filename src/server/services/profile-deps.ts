import "server-only";
import {
  createDailyTargetsRepository,
  createProfileRepository,
  createWeightRepository,
} from "@/server/repositories/supabase-repositories";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { ProfileDeps } from "./profile-service";

/** Arma las dependencias reales del servicio de perfil para el usuario actual. */
export async function profileDeps(): Promise<ProfileDeps> {
  const db = await createSupabaseServerClient();
  return {
    profiles: createProfileRepository(db),
    weights: createWeightRepository(db),
    targets: createDailyTargetsRepository(db),
    now: () => new Date(),
  };
}
