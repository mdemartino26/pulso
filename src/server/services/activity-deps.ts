import "server-only";
import {
  createActivityCatalogRepository,
  createActivityEntryRepository,
  createStepRepository,
} from "@/server/repositories/activity-repositories";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { ActivityDeps } from "./activity-service";
import { profileDeps } from "./profile-deps";
import { recomputeTargets, todayFor } from "./profile-service";

/** Arma las dependencias reales del servicio de actividad para el usuario actual. */
export async function activityDeps(userId: string): Promise<ActivityDeps> {
  const db = await createSupabaseServerClient();
  const profile = await profileDeps();
  return {
    catalog: createActivityCatalogRepository(db),
    entries: createActivityEntryRepository(db),
    steps: createStepRepository(db),
    weights: profile.weights,
    today: async () => {
      const p = await profile.profiles.get(userId);
      return todayFor(profile, p?.timezone ?? "");
    },
    recomputeDay: (date) => recomputeTargets(profile, userId, date),
  };
}
