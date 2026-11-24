import "server-only";
import type { DailyTargets } from "@/lib/calc";
import type { Database } from "@/server/db/database.types";
import type { ServerSupabaseClient } from "@/server/supabase/server";
import {
  RepositoryError,
  type DailyTargetsRepository,
  type ProfileRecord,
  type ProfileRepository,
  type WeightRepository,
} from "./types";

/*
 * Implementaciones con Supabase. Usan el cliente del usuario (clave
 * publishable + su sesión): RLS garantiza que solo toquen sus filas. Igual
 * se filtra por user_id explícitamente, como segunda capa.
 */

export function createProfileRepository(db: ServerSupabaseClient): ProfileRepository {
  return {
    async get(userId) {
      const { data, error } = await db
        .from("profiles")
        .select(
          "id, sex, birth_date, height_cm, activity_level, timezone, goal, weekly_rate_kg, water_goal_ml_override, onboarding_completed_at",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new RepositoryError("profiles.get", error);
      if (!data) return null;
      const profile: ProfileRecord = {
        id: data.id,
        sex: data.sex,
        birthDate: data.birth_date,
        heightCm: data.height_cm === null ? null : Number(data.height_cm),
        activityLevel: data.activity_level,
        timezone: data.timezone,
        goal: data.goal,
        weeklyRateKg: data.weekly_rate_kg === null ? null : Number(data.weekly_rate_kg),
        waterGoalOverrideMl: data.water_goal_ml_override,
        onboardingCompletedAt: data.onboarding_completed_at,
      };
      return profile;
    },

    async update(userId, patch) {
      const row: Database["public"]["Tables"]["profiles"]["Update"] = {};
      if (patch.sex !== undefined) row.sex = patch.sex;
      if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
      if (patch.heightCm !== undefined) row.height_cm = patch.heightCm;
      if (patch.activityLevel !== undefined) row.activity_level = patch.activityLevel;
      if (patch.timezone !== undefined) row.timezone = patch.timezone;
      if (patch.goal !== undefined) row.goal = patch.goal;
      if (patch.weeklyRateKg !== undefined) row.weekly_rate_kg = patch.weeklyRateKg;
      if (patch.waterGoalOverrideMl !== undefined) row.water_goal_ml_override = patch.waterGoalOverrideMl;
      if (patch.onboardingCompletedAt !== undefined) row.onboarding_completed_at = patch.onboardingCompletedAt;

      const { error } = await db.from("profiles").update(row).eq("id", userId);
      if (error) throw new RepositoryError("profiles.update", error);
    },
  };
}

export function createWeightRepository(db: ServerSupabaseClient): WeightRepository {
  return {
    async latestOnOrBefore(userId, date) {
      const { data, error } = await db
        .from("weight_entries")
        .select("date, weight_kg")
        .eq("user_id", userId)
        .lte("date", date)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new RepositoryError("weight_entries.latest", error);
      return data ? { date: data.date, weightKg: Number(data.weight_kg) } : null;
    },

    async upsert(userId, date, weightKg) {
      const { error } = await db
        .from("weight_entries")
        .upsert({ user_id: userId, date, weight_kg: weightKg }, { onConflict: "user_id,date" });
      if (error) throw new RepositoryError("weight_entries.upsert", error);
    },
  };
}

export function createDailyTargetsRepository(db: ServerSupabaseClient): DailyTargetsRepository {
  return {
    async get(userId, date) {
      const { data, error } = await db
        .from("daily_targets")
        .select("bmr_kcal, tdee_kcal, kcal_target, protein_min_g, protein_max_g, water_ml")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();
      if (error) throw new RepositoryError("daily_targets.get", error);
      if (!data) return null;
      const targets: DailyTargets = {
        bmrKcal: data.bmr_kcal,
        tdeeKcal: data.tdee_kcal,
        kcalTarget: data.kcal_target,
        floorApplied: false,
        proteinMinG: data.protein_min_g,
        proteinMaxG: data.protein_max_g,
        waterMl: data.water_ml,
      };
      return targets;
    },

    async upsert(userId, date, t) {
      const { error } = await db.from("daily_targets").upsert(
        {
          user_id: userId,
          date,
          bmr_kcal: t.bmrKcal,
          tdee_kcal: t.tdeeKcal,
          kcal_target: t.kcalTarget,
          protein_min_g: t.proteinMinG,
          protein_max_g: t.proteinMaxG,
          water_ml: t.waterMl,
          source: "formula",
        },
        { onConflict: "user_id,date" },
      );
      if (error) throw new RepositoryError("daily_targets.upsert", error);
    },
  };
}
