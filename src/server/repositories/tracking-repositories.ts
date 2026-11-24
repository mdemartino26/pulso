import "server-only";
import type { ServerSupabaseClient } from "@/server/supabase/server";
import type { HabitRepository, WaterRepository, WeightHistoryRepository, WellbeingRepository } from "./tracking-types";
import { RepositoryError } from "./types";

/*
 * Repositorios de agua, peso, bienestar y hábitos con el cliente del usuario
 * (RLS). Además se filtra por user_id en cada consulta, como segunda barrera.
 */

export function createWaterRepository(db: ServerSupabaseClient): WaterRepository {
  return {
    async total(userId, date) {
      const { data, error } = await db.from("water_entries").select("amount_ml").eq("user_id", userId).eq("date", date).limit(500);
      if (error) throw new RepositoryError("water_entries.total", error);
      return data.reduce((s, r) => s + r.amount_ml, 0);
    },
    async add(userId, date, amountMl) {
      const { error } = await db.from("water_entries").insert({ user_id: userId, date, amount_ml: amountMl });
      if (error) throw new RepositoryError("water_entries.add", error);
    },
    async removeLast(userId, date) {
      const { data, error } = await db
        .from("water_entries")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new RepositoryError("water_entries.last", error);
      if (!data) return false;
      const del = await db.from("water_entries").delete().eq("user_id", userId).eq("id", data.id);
      if (del.error) throw new RepositoryError("water_entries.remove", del.error);
      return true;
    },
  };
}

export function createWeightHistoryRepository(db: ServerSupabaseClient): WeightHistoryRepository {
  return {
    async list(userId, from, to) {
      const { data, error } = await db
        .from("weight_entries")
        .select("date, weight_kg")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .limit(1000);
      if (error) throw new RepositoryError("weight_entries.list", error);
      return data.map((r) => ({ date: r.date, weightKg: Number(r.weight_kg) }));
    },
    async remove(userId, date) {
      const { data, error } = await db.from("weight_entries").delete().eq("user_id", userId).eq("date", date).select("date");
      if (error) throw new RepositoryError("weight_entries.remove", error);
      return data.length > 0;
    },
    async count(userId) {
      const { count, error } = await db
        .from("weight_entries")
        .select("date", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) throw new RepositoryError("weight_entries.count", error);
      return count ?? 0;
    },
  };
}

type WellbeingRow = { date: string; sleep_hours: number | string | null; mood: number | null };
const toWellbeing = (r: WellbeingRow) => ({
  date: r.date,
  sleepHours: r.sleep_hours === null ? null : Number(r.sleep_hours),
  mood: r.mood,
});

export function createWellbeingRepository(db: ServerSupabaseClient): WellbeingRepository {
  return {
    async get(userId, date) {
      const { data, error } = await db
        .from("wellbeing_entries")
        .select("date, sleep_hours, mood")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();
      if (error) throw new RepositoryError("wellbeing_entries.get", error);
      return data ? toWellbeing(data) : null;
    },
    async list(userId, from, to) {
      const { data, error } = await db
        .from("wellbeing_entries")
        .select("date, sleep_hours, mood")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .limit(400);
      if (error) throw new RepositoryError("wellbeing_entries.list", error);
      return data.map(toWellbeing);
    },
    async upsert(userId, e) {
      const { error } = await db
        .from("wellbeing_entries")
        .upsert({ user_id: userId, date: e.date, sleep_hours: e.sleepHours, mood: e.mood }, { onConflict: "user_id,date" });
      if (error) throw new RepositoryError("wellbeing_entries.upsert", error);
    },
  };
}

export function createHabitRepository(db: ServerSupabaseClient): HabitRepository {
  return {
    async list(userId) {
      const { data, error } = await db
        .from("habits")
        .select("id, name, sort_order")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw new RepositoryError("habits.list", error);
      return data.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order }));
    },
    async create(userId, name, sortOrder) {
      const { data, error } = await db.from("habits").insert({ user_id: userId, name, sort_order: sortOrder }).select("id").single();
      if (error) throw new RepositoryError("habits.create", error);
      return data.id;
    },
    async rename(userId, habitId, name) {
      const { data, error } = await db
        .from("habits")
        .update({ name })
        .eq("user_id", userId)
        .eq("id", habitId)
        .is("archived_at", null)
        .select("id");
      if (error) throw new RepositoryError("habits.rename", error);
      return data.length > 0;
    },
    async archive(userId, habitId) {
      const { data, error } = await db
        .from("habits")
        .update({ archived_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", habitId)
        .is("archived_at", null)
        .select("id");
      if (error) throw new RepositoryError("habits.archive", error);
      return data.length > 0;
    },
    async checks(userId, from, to) {
      const { data, error } = await db
        .from("habit_checks")
        .select("habit_id, date")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .limit(5000);
      if (error) throw new RepositoryError("habit_checks.list", error);
      return data.map((r) => ({ habitId: r.habit_id, date: r.date }));
    },
    async setCheck(userId, habitId, date, done) {
      if (done) {
        const { error } = await db
          .from("habit_checks")
          .upsert({ habit_id: habitId, user_id: userId, date }, { onConflict: "habit_id,date", ignoreDuplicates: true });
        if (error) throw new RepositoryError("habit_checks.add", error);
      } else {
        const { error } = await db.from("habit_checks").delete().eq("user_id", userId).eq("habit_id", habitId).eq("date", date);
        if (error) throw new RepositoryError("habit_checks.remove", error);
      }
    },
  };
}
