import "server-only";
import type { ServerSupabaseClient } from "@/server/supabase/server";
import type {
  ActivityCatalogRepository,
  ActivityEntry,
  ActivityEntryRepository,
  StepRepository,
} from "./activity-types";
import { RepositoryError } from "./types";

/*
 * Repositorios de actividad con el cliente del usuario (RLS). Además se
 * filtra por user_id en cada consulta, como segunda barrera.
 */

const ENTRY_COLUMNS =
  "id, date, met_activity_id, intensity, duration_min, met_value, kcal, steps_included, strength_sets(exercise_id, set_number, reps, weight_kg)";

type EntryRow = {
  id: string;
  date: string;
  met_activity_id: number;
  intensity: ActivityEntry["intensity"];
  duration_min: number;
  met_value: number | string;
  kcal: number;
  steps_included: number;
  strength_sets: { exercise_id: number; set_number: number; reps: number; weight_kg: number | string }[] | null;
};

function rowToEntry(r: EntryRow): ActivityEntry {
  return {
    id: r.id,
    date: r.date,
    metActivityId: r.met_activity_id,
    intensity: r.intensity,
    durationMin: r.duration_min,
    metValue: Number(r.met_value),
    kcal: r.kcal,
    stepsIncluded: r.steps_included,
    sets: (r.strength_sets ?? [])
      .map((s) => ({ exerciseId: s.exercise_id, setNumber: s.set_number, reps: s.reps, weightKg: Number(s.weight_kg) }))
      .sort((a, b) => a.setNumber - b.setNumber),
  };
}

export function createActivityCatalogRepository(db: ServerSupabaseClient): ActivityCatalogRepository {
  return {
    async activities() {
      const { data, error } = await db
        .from("met_activities")
        .select("id, slug, name_es, category, met_low, met_moderate, met_high, is_ambulatory")
        .order("id");
      if (error) throw new RepositoryError("met_activities.list", error);
      return data.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name_es,
        category: r.category,
        metLow: Number(r.met_low),
        metModerate: Number(r.met_moderate),
        metHigh: Number(r.met_high),
        isAmbulatory: r.is_ambulatory,
      }));
    },
    async exercises() {
      const { data, error } = await db.from("exercises").select("id, slug, name_es, muscle_group").order("id");
      if (error) throw new RepositoryError("exercises.list", error);
      return data.map((r) => ({ id: r.id, slug: r.slug, name: r.name_es, muscleGroup: r.muscle_group }));
    },
  };
}

export function createActivityEntryRepository(db: ServerSupabaseClient): ActivityEntryRepository {
  async function insertSets(userId: string, entryId: string, sets: ActivityEntry["sets"]) {
    if (sets.length === 0) return;
    const { error } = await db.from("strength_sets").insert(
      sets.map((s) => ({
        user_id: userId,
        activity_entry_id: entryId,
        exercise_id: s.exerciseId,
        set_number: s.setNumber,
        reps: s.reps,
        weight_kg: s.weightKg,
      })),
    );
    if (error) throw new RepositoryError("strength_sets.insert", error);
  }

  return {
    async listByDate(userId, date) {
      const { data, error } = await db
        .from("activity_entries")
        .select(ENTRY_COLUMNS)
        .eq("user_id", userId)
        .eq("date", date)
        .order("created_at");
      if (error) throw new RepositoryError("activity_entries.listByDate", error);
      return (data as unknown as EntryRow[]).map(rowToEntry);
    },
    async get(userId, id) {
      const { data, error } = await db
        .from("activity_entries")
        .select(ENTRY_COLUMNS)
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new RepositoryError("activity_entries.get", error);
      return data ? rowToEntry(data as unknown as EntryRow) : null;
    },
    async insert(userId, e) {
      const { data, error } = await db
        .from("activity_entries")
        .insert({
          user_id: userId,
          date: e.date,
          met_activity_id: e.metActivityId,
          intensity: e.intensity,
          duration_min: e.durationMin,
          met_value: e.metValue,
          kcal: e.kcal,
          steps_included: e.stepsIncluded,
        })
        .select("id")
        .single();
      if (error) throw new RepositoryError("activity_entries.insert", error);
      try {
        await insertSets(userId, data.id, e.sets);
      } catch (err) {
        // Sin transacciones en la API: si fallan las series, deshacemos la actividad.
        await db.from("activity_entries").delete().eq("user_id", userId).eq("id", data.id);
        throw err;
      }
      return data.id;
    },
    async update(userId, id, e) {
      const { data, error } = await db
        .from("activity_entries")
        .update({
          met_activity_id: e.metActivityId,
          intensity: e.intensity,
          duration_min: e.durationMin,
          met_value: e.metValue,
          kcal: e.kcal,
          steps_included: e.stepsIncluded,
        })
        .eq("user_id", userId)
        .eq("id", id)
        .select("id");
      if (error) throw new RepositoryError("activity_entries.update", error);
      if (data.length === 0) return false;
      // Las series se reemplazan enteras.
      const del = await db.from("strength_sets").delete().eq("user_id", userId).eq("activity_entry_id", id);
      if (del.error) throw new RepositoryError("strength_sets.delete", del.error);
      await insertSets(userId, id, e.sets);
      return true;
    },
    async remove(userId, id) {
      // Las series se borran en cascada (FK on delete cascade).
      const { data, error } = await db.from("activity_entries").delete().eq("user_id", userId).eq("id", id).select("id");
      if (error) throw new RepositoryError("activity_entries.remove", error);
      return data.length > 0;
    },
    async strengthHistory(userId, exerciseId, limit) {
      const { data, error } = await db
        .from("strength_sets")
        .select("activity_entry_id, set_number, reps, weight_kg, created_at, activity_entries(date)")
        .eq("user_id", userId)
        .eq("exercise_id", exerciseId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new RepositoryError("strength_sets.history", error);
      type Row = { activity_entry_id: string; set_number: number; reps: number; weight_kg: number | string; activity_entries: { date: string } | null };
      return (data as unknown as Row[]).flatMap((r) =>
        r.activity_entries
          ? [{ date: r.activity_entries.date, entryId: r.activity_entry_id, setNumber: r.set_number, reps: r.reps, weightKg: Number(r.weight_kg) }]
          : [],
      );
    },
    async trainedExerciseIds(userId) {
      const { data, error } = await db
        .from("strength_sets")
        .select("exercise_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw new RepositoryError("strength_sets.trained", error);
      return [...new Set(data.map((r) => r.exercise_id))];
    },
  };
}

export function createStepRepository(db: ServerSupabaseClient): StepRepository {
  return {
    async get(userId, date) {
      const { data, error } = await db
        .from("step_entries")
        .select("steps")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();
      if (error) throw new RepositoryError("step_entries.get", error);
      return data?.steps ?? null;
    },
    async upsert(userId, date, steps) {
      const { error } = await db
        .from("step_entries")
        .upsert({ user_id: userId, date, steps }, { onConflict: "user_id,date" });
      if (error) throw new RepositoryError("step_entries.upsert", error);
    },
  };
}
