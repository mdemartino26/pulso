import "server-only";
import { createActivityEntryRepository, createStepRepository } from "@/server/repositories/activity-repositories";
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
  const entries = createActivityEntryRepository(db);
  const steps = createStepRepository(db);
  return {
    profiles: createProfileRepository(db),
    weights: createWeightRepository(db),
    targets: createDailyTargetsRepository(db),
    now: () => new Date(),
    // Ejercicio y pasos del día: suman al gasto y a la meta de ese día.
    activityLog: async (userId, date) => {
      const [list, stepCount] = await Promise.all([entries.listByDate(userId, date), steps.get(userId, date)]);
      return { entries: list.map((e) => ({ kcal: e.kcal, stepsIncluded: e.stepsIncluded })), steps: stepCount };
    },
  };
}
