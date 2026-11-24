import "server-only";
import type { ServerSupabaseClient } from "@/server/supabase/server";
import type { TrendsRepository } from "./trends-types";
import { RepositoryError } from "./types";

/*
 * Lecturas por rango de fechas para la pantalla de tendencias (RLS + filtro
 * por user_id). Se piden solo las columnas necesarias y con tope de filas.
 */

const MAX_ROWS = 10_000;

export function createTrendsRepository(db: ServerSupabaseClient): TrendsRepository {
  return {
    async foodTotals(userId, from, to) {
      const { data, error } = await db
        .from("food_entries")
        .select("date, kcal, protein_g")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .limit(MAX_ROWS);
      if (error) throw new RepositoryError("food_entries.range", error);
      return data.map((r) => ({ date: r.date, kcal: Number(r.kcal), protein: Number(r.protein_g) }));
    },
    async targets(userId, from, to) {
      const { data, error } = await db
        .from("daily_targets")
        .select("date, kcal_target, protein_min_g, protein_max_g, water_ml")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .limit(MAX_ROWS);
      if (error) throw new RepositoryError("daily_targets.range", error);
      return data.map((r) => ({
        date: r.date,
        kcalTarget: r.kcal_target,
        proteinMinG: r.protein_min_g,
        proteinMaxG: r.protein_max_g,
        waterMl: r.water_ml,
      }));
    },
    async activity(userId, from, to) {
      const { data, error } = await db
        .from("activity_entries")
        .select("date, kcal, duration_min")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .limit(MAX_ROWS);
      if (error) throw new RepositoryError("activity_entries.range", error);
      return data.map((r) => ({ date: r.date, kcal: r.kcal, minutes: r.duration_min }));
    },
    async steps(userId, from, to) {
      const { data, error } = await db
        .from("step_entries")
        .select("date, steps")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .limit(MAX_ROWS);
      if (error) throw new RepositoryError("step_entries.range", error);
      return data;
    },
    async water(userId, from, to) {
      const { data, error } = await db
        .from("water_entries")
        .select("date, amount_ml")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .limit(MAX_ROWS);
      if (error) throw new RepositoryError("water_entries.range", error);
      return data.map((r) => ({ date: r.date, ml: r.amount_ml }));
    },
  };
}
