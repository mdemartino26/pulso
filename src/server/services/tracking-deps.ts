import "server-only";
import {
  createHabitRepository,
  createWaterRepository,
  createWeightHistoryRepository,
  createWellbeingRepository,
} from "@/server/repositories/tracking-repositories";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { profileDeps } from "./profile-deps";
import { recomputeTargets, todayFor } from "./profile-service";
import type { TrackingDeps } from "./tracking-service";

/** Arma las dependencias reales del servicio de seguimiento para el usuario actual. */
export async function trackingDeps(userId: string): Promise<TrackingDeps> {
  const db = await createSupabaseServerClient();
  const profile = await profileDeps();
  return {
    water: createWaterRepository(db),
    weights: profile.weights,
    weightHistory: createWeightHistoryRepository(db),
    wellbeing: createWellbeingRepository(db),
    habits: createHabitRepository(db),
    today: async () => {
      const p = await profile.profiles.get(userId);
      return todayFor(profile, p?.timezone ?? "");
    },
    recomputeDay: (date) => recomputeTargets(profile, userId, date),
  };
}
