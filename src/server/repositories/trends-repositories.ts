import "server-only";
import type { ServerSupabaseClient } from "@/server/supabase/server";
import type { TrendsRepository } from "./trends-types";
import { fetchAllPages } from "./paged";

/*
 * Lecturas por rango de fechas para la pantalla de tendencias (RLS + filtro
 * por user_id). Se piden solo las columnas necesarias y con tope de filas.
 */

const MAX_ROWS = 20_000;

export function createTrendsRepository(
  db: ServerSupabaseClient,
): TrendsRepository {
  return {
    async foodTotals(userId, from, to) {
      const data = await fetchAllPages(
        "food_entries.range",
        (a, b) =>
          db
            .from("food_entries")
            .select("date, kcal, protein_g")
            .eq("user_id", userId)
            .gte("date", from)
            .lte("date", to)
            .order("id")
            .range(a, b),
        MAX_ROWS,
      );
      return data.map((r) => ({
        date: r.date,
        kcal: Number(r.kcal),
        protein: Number(r.protein_g),
      }));
    },
    async targets(userId, from, to) {
      const data = await fetchAllPages(
        "daily_targets.range",
        (a, b) =>
          db
            .from("daily_targets")
            .select("date, kcal_target, protein_min_g, protein_max_g, water_ml")
            .eq("user_id", userId)
            .gte("date", from)
            .lte("date", to)
            .order("date", { ascending: true })
            .range(a, b),
        MAX_ROWS,
      );
      return data.map((r) => ({
        date: r.date,
        kcalTarget: r.kcal_target,
        proteinMinG: r.protein_min_g,
        proteinMaxG: r.protein_max_g,
        waterMl: r.water_ml,
      }));
    },
    async activity(userId, from, to) {
      const data = await fetchAllPages(
        "activity_entries.range",
        (a, b) =>
          db
            .from("activity_entries")
            .select("date, kcal, duration_min")
            .eq("user_id", userId)
            .gte("date", from)
            .lte("date", to)
            .order("id")
            .range(a, b),
        MAX_ROWS,
      );
      return data.map((r) => ({
        date: r.date,
        kcal: r.kcal,
        minutes: r.duration_min,
      }));
    },
    async steps(userId, from, to) {
      const data = await fetchAllPages(
        "step_entries.range",
        (a, b) =>
          db
            .from("step_entries")
            .select("date, steps")
            .eq("user_id", userId)
            .gte("date", from)
            .lte("date", to)
            .order("id")
            .range(a, b),
        MAX_ROWS,
      );
      return data;
    },
    async water(userId, from, to) {
      const data = await fetchAllPages(
        "water_entries.range",
        (a, b) =>
          db
            .from("water_entries")
            .select("date, amount_ml")
            .eq("user_id", userId)
            .gte("date", from)
            .lte("date", to)
            .order("id")
            .range(a, b),
        MAX_ROWS,
      );
      return data.map((r) => ({ date: r.date, ml: r.amount_ml }));
    },
  };
}
