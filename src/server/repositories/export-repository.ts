import "server-only";
import type { CsvValue } from "@/lib/export/csv";
import type { ServerSupabaseClient } from "@/server/supabase/server";
import { fetchAllPages } from "./paged";
import { RepositoryError } from "./types";

/*
 * Lee TODOS los datos de la persona para exportarlos, con el cliente del
 * usuario (RLS) y filtrando por user_id. Supabase devuelve como máximo 1000
 * filas por consulta, así que se pide por páginas.
 */

export type ExportRow = Record<string, CsvValue>;
export interface ExportTable {
  /** Nombre del archivo CSV (sin extensión). */
  name: string;
  columns: readonly string[];
  rows: ExportRow[];
}

/** Pide todas las páginas; el label queda en el log si algo falla. */
const all = <T>(label: string, page: Parameters<typeof fetchAllPages<T>>[1]) =>
  fetchAllPages<T>(`${label}.export`, page);

export interface ExportRepository {
  tables(userId: string): Promise<ExportTable[]>;
}

export function createExportRepository(
  db: ServerSupabaseClient,
): ExportRepository {
  return {
    async tables(userId) {
      const [
        profile,
        weights,
        targets,
        food,
        customFoods,
        activities,
        sets,
        steps,
        water,
        wellbeing,
        habits,
        checks,
        metCatalog,
        exCatalog,
      ] = await Promise.all([
        db
          .from("profiles")
          .select(
            "sex, birth_date, height_cm, activity_level, timezone, goal, weekly_rate_kg, water_goal_ml_override, onboarding_completed_at, created_at",
          )
          .eq("id", userId),
        all("weight_entries", (a, b) =>
          db
            .from("weight_entries")
            .select("date, weight_kg")
            .eq("user_id", userId)
            .order("date")
            .range(a, b),
        ),
        all("daily_targets", (a, b) =>
          db
            .from("daily_targets")
            .select(
              "date, bmr_kcal, tdee_kcal, kcal_target, protein_min_g, protein_max_g, water_ml, source",
            )
            .eq("user_id", userId)
            .order("date")
            .range(a, b),
        ),
        all("food_entries", (a, b) =>
          db
            .from("food_entries")
            .select(
              "date, meal, name, brand, quantity, unit, amount, kcal, protein_g, carbs_g, fat_g, fiber_g, sugars_g, sodium_mg, source, created_at",
            )
            .eq("user_id", userId)
            .order("date")
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all("custom_foods", (a, b) =>
          db
            .from("custom_foods")
            .select(
              "name, brand, basis, kcal_100, protein_100, carbs_100, fat_100, fiber_100, sugars_100, sodium_mg_100, serving_size, serving_label, created_at",
            )
            .eq("user_id", userId)
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all("activity_entries", (a, b) =>
          db
            .from("activity_entries")
            .select(
              "id, date, met_activity_id, intensity, duration_min, met_value, kcal, steps_included, created_at",
            )
            .eq("user_id", userId)
            .order("date")
            .order("id")
            .range(a, b),
        ),
        all("strength_sets", (a, b) =>
          db
            .from("strength_sets")
            .select(
              "activity_entry_id, exercise_id, set_number, reps, weight_kg",
            )
            .eq("user_id", userId)
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all("step_entries", (a, b) =>
          db
            .from("step_entries")
            .select("date, steps")
            .eq("user_id", userId)
            .order("date")
            .range(a, b),
        ),
        all("water_entries", (a, b) =>
          db
            .from("water_entries")
            .select("date, amount_ml, created_at")
            .eq("user_id", userId)
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all("wellbeing_entries", (a, b) =>
          db
            .from("wellbeing_entries")
            .select("date, sleep_hours, mood")
            .eq("user_id", userId)
            .order("date")
            .range(a, b),
        ),
        all("habits", (a, b) =>
          db
            .from("habits")
            .select("id, name, archived_at, created_at")
            .eq("user_id", userId)
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all("habit_checks", (a, b) =>
          db
            .from("habit_checks")
            .select("habit_id, date")
            .eq("user_id", userId)
            .order("date")
            .order("habit_id")
            .range(a, b),
        ),
        db.from("met_activities").select("id, name_es"),
        db.from("exercises").select("id, name_es"),
      ]);

      for (const [label, r] of [
        ["profiles", profile],
        ["met_activities", metCatalog],
        ["exercises", exCatalog],
      ] as const) {
        if (r.error) throw new RepositoryError(`${label}.export`, r.error);
      }
      const metName = new Map(
        (metCatalog.data ?? []).map((m) => [m.id, m.name_es]),
      );
      const exName = new Map(
        (exCatalog.data ?? []).map((e) => [e.id, e.name_es]),
      );
      const habitName = new Map(habits.map((h) => [h.id, h.name]));

      const table = (
        name: string,
        columns: readonly string[],
        rows: ExportRow[],
      ): ExportTable => ({ name, columns, rows });
      return [
        table(
          "perfil",
          [
            "sex",
            "birth_date",
            "height_cm",
            "activity_level",
            "timezone",
            "goal",
            "weekly_rate_kg",
            "water_goal_ml_override",
            "onboarding_completed_at",
            "created_at",
          ],
          (profile.data ?? []) as ExportRow[],
        ),
        table("pesos", ["date", "weight_kg"], weights),
        table(
          "metas_diarias",
          [
            "date",
            "bmr_kcal",
            "tdee_kcal",
            "kcal_target",
            "protein_min_g",
            "protein_max_g",
            "water_ml",
            "source",
          ],
          targets,
        ),
        table(
          "comidas",
          [
            "date",
            "meal",
            "name",
            "brand",
            "quantity",
            "unit",
            "amount",
            "kcal",
            "protein_g",
            "carbs_g",
            "fat_g",
            "fiber_g",
            "sugars_g",
            "sodium_mg",
            "source",
            "created_at",
          ],
          food,
        ),
        table(
          "alimentos_propios",
          [
            "name",
            "brand",
            "basis",
            "kcal_100",
            "protein_100",
            "carbs_100",
            "fat_100",
            "fiber_100",
            "sugars_100",
            "sodium_mg_100",
            "serving_size",
            "serving_label",
            "created_at",
          ],
          customFoods,
        ),
        table(
          "actividades",
          [
            "id",
            "date",
            "activity",
            "intensity",
            "duration_min",
            "met_value",
            "kcal",
            "steps_included",
            "created_at",
          ],
          activities.map(({ met_activity_id, ...r }) => ({
            ...r,
            activity: metName.get(met_activity_id) ?? String(met_activity_id),
          })),
        ),
        table(
          "series_fuerza",
          ["activity_entry_id", "exercise", "set_number", "reps", "weight_kg"],
          sets.map(({ exercise_id, ...r }) => ({
            ...r,
            exercise: exName.get(exercise_id) ?? String(exercise_id),
          })),
        ),
        table("pasos", ["date", "steps"], steps),
        table("agua", ["date", "amount_ml", "created_at"], water),
        table("sueno_y_animo", ["date", "sleep_hours", "mood"], wellbeing),
        table("habitos", ["id", "name", "archived_at", "created_at"], habits),
        table(
          "habitos_marcados",
          ["habit_id", "habit", "date"],
          checks.map((c) => ({ ...c, habit: habitName.get(c.habit_id) ?? "" })),
        ),
      ];
    },
  };
}
