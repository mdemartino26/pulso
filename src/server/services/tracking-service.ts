import { z } from "zod";
import { addDays, habitWindow, movingAverage, type DailyTargets, type HabitWindow, type IsoDate } from "@/lib/calc";
import {
  addWaterSchema,
  createHabitSchema,
  deleteWeightSchema,
  habitIdSchema,
  renameHabitSchema,
  toggleHabitSchema,
  undoWaterSchema,
  weightSchema,
  wellbeingSchema,
} from "@/lib/validation/tracking";
import type {
  Habit,
  HabitRepository,
  WaterRepository,
  WeightHistoryRepository,
  Wellbeing,
  WellbeingRepository,
} from "@/server/repositories/tracking-types";
import type { WeightRepository } from "@/server/repositories/types";

/**
 * Agua, peso, sueño, ánimo y hábitos. No conoce Supabase: recibe repositorios.
 * Cambiar el peso recalcula las metas (basal, calorías, proteína y agua).
 */

export interface TrackingDeps {
  water: WaterRepository;
  weights: WeightRepository;
  weightHistory: WeightHistoryRepository;
  wellbeing: WellbeingRepository;
  habits: HabitRepository;
  today: () => Promise<IsoDate>;
  recomputeDay: (date: IsoDate) => Promise<DailyTargets | null>;
}

export type TrackingError = "invalid_input" | "not_found" | "date_out_of_range" | "last_weight" | "too_many_habits";
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: TrackingError; fieldErrors?: Record<string, string[] | undefined> };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: TrackingError, fieldErrors?: Record<string, string[] | undefined>): Result<never> =>
  fieldErrors ? { ok: false, code, fieldErrors } : { ok: false, code };
const flat = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

const MAX_DAYS_BACK = 366;
export const MAX_HABITS = 20;

async function inRange(deps: TrackingDeps, date: IsoDate) {
  const today = await deps.today();
  return date <= today && date >= addDays(today, -MAX_DAYS_BACK);
}

// --- Agua --------------------------------------------------------------------

export async function addWater(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<{ totalMl: number }>> {
  const parsed = addWaterSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const { date, amountMl } = parsed.data;
  if (!(await inRange(deps, date))) return fail("date_out_of_range");
  await deps.water.add(userId, date, amountMl);
  return ok({ totalMl: await deps.water.total(userId, date) });
}

export async function undoWater(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<{ totalMl: number }>> {
  const parsed = undoWaterSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");
  if (!(await deps.water.removeLast(userId, parsed.data.date))) return fail("not_found");
  return ok({ totalMl: await deps.water.total(userId, parsed.data.date) });
}

// --- Peso --------------------------------------------------------------------

/** El peso de un día cambia las metas de ese día y las de hoy. */
async function recomputeAfterWeight(deps: TrackingDeps, date: IsoDate) {
  const today = await deps.today();
  await deps.recomputeDay(date);
  if (date !== today) await deps.recomputeDay(today);
}

export async function logWeight(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = weightSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const { date, weightKg } = parsed.data;
  if (!(await inRange(deps, date))) return fail("date_out_of_range");
  await deps.weights.upsert(userId, date, Math.round(weightKg * 100) / 100);
  await recomputeAfterWeight(deps, date);
  return ok({ date });
}

export async function deleteWeight(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = deleteWeightSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");
  // Sin ningún peso no se pueden calcular las metas: el último no se borra.
  if ((await deps.weightHistory.count(userId)) <= 1) return fail("last_weight");
  if (!(await deps.weightHistory.remove(userId, parsed.data.date))) return fail("not_found");
  await recomputeAfterWeight(deps, parsed.data.date);
  return ok({ date: parsed.data.date });
}

export interface WeightHistory {
  points: { date: IsoDate; weightKg: number; trend: number }[];
  latest: { date: IsoDate; weightKg: number; trend: number } | null;
  /** Cambio de la tendencia contra ~7 días antes (null si no hay datos suficientes). */
  weeklyChange: number | null;
}

export async function getWeightHistory(deps: TrackingDeps, userId: string, days = 90): Promise<WeightHistory> {
  const today = await deps.today();
  // Se piden 6 días extra para que el promedio del primer día visible tenga su ventana.
  const from = addDays(today, -(days + 6));
  const rows = await deps.weightHistory.list(userId, from, today);
  const avg = movingAverage(rows.map((r) => ({ date: r.date, value: r.weightKg })), 7);
  const visibleFrom = addDays(today, -days);
  const points = avg.filter((p) => p.date >= visibleFrom).map((p) => ({ date: p.date, weightKg: p.value, trend: p.average }));
  const latest = points.at(-1) ?? null;
  let weeklyChange: number | null = null;
  if (latest) {
    const weekAgo = [...avg].reverse().find((p) => p.date <= addDays(latest.date, -7));
    if (weekAgo) weeklyChange = Math.round((latest.trend - weekAgo.average) * 10) / 10;
  }
  return { points, latest, weeklyChange };
}

// --- Sueño y ánimo -----------------------------------------------------------

export async function saveWellbeing(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = wellbeingSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const { date, sleepHours, mood } = parsed.data;
  if (!(await inRange(deps, date))) return fail("date_out_of_range");
  // Completar solo uno de los dos no borra el otro.
  const current = await deps.wellbeing.get(userId, date);
  await deps.wellbeing.upsert(userId, {
    date,
    sleepHours: sleepHours !== undefined ? Math.round(sleepHours * 2) / 2 : (current?.sleepHours ?? null),
    mood: mood ?? current?.mood ?? null,
  });
  return ok({ date });
}

// --- Hábitos -----------------------------------------------------------------

export async function createHabit(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = createHabitSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const habits = await deps.habits.list(userId);
  if (habits.length >= MAX_HABITS) return fail("too_many_habits");
  const order = habits.reduce((m, h) => Math.max(m, h.sortOrder), -1) + 1;
  return ok({ id: await deps.habits.create(userId, parsed.data.name, order) });
}

export async function renameHabit(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<null>> {
  const parsed = renameHabitSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  if (!(await deps.habits.rename(userId, parsed.data.habitId, parsed.data.name))) return fail("not_found");
  return ok(null);
}

export async function archiveHabit(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<null>> {
  const parsed = habitIdSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");
  if (!(await deps.habits.archive(userId, parsed.data.habitId))) return fail("not_found");
  return ok(null);
}

export async function toggleHabit(deps: TrackingDeps, userId: string, raw: unknown): Promise<Result<{ done: boolean }>> {
  const parsed = toggleHabitSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");
  const { habitId, date, done } = parsed.data;
  if (!(await inRange(deps, date))) return fail("date_out_of_range");
  // Solo hábitos activos propios (RLS además impide tocar los ajenos).
  const habits = await deps.habits.list(userId);
  if (!habits.some((h) => h.id === habitId)) return fail("not_found");
  await deps.habits.setCheck(userId, habitId, date, done);
  return ok({ done });
}

// --- Lecturas del día --------------------------------------------------------

export interface HabitView extends Habit, HabitWindow {}

export interface TrackingDay {
  date: IsoDate;
  waterMl: number;
  wellbeing: Wellbeing | null;
  habits: HabitView[];
}

export async function getTrackingDay(deps: TrackingDeps, userId: string, date: IsoDate): Promise<TrackingDay> {
  const [waterMl, wellbeing, habits, checks] = await Promise.all([
    deps.water.total(userId, date),
    deps.wellbeing.get(userId, date),
    deps.habits.list(userId),
    deps.habits.checks(userId, addDays(date, -6), date),
  ]);
  return {
    date,
    waterMl,
    wellbeing,
    habits: habits.map((h) => ({
      ...h,
      ...habitWindow(
        checks.filter((c) => c.habitId === h.id).map((c) => c.date),
        date,
      ),
    })),
  };
}

export async function getWellbeingHistory(deps: TrackingDeps, userId: string, days = 14): Promise<Wellbeing[]> {
  const today = await deps.today();
  return deps.wellbeing.list(userId, addDays(today, -(days - 1)), today);
}
