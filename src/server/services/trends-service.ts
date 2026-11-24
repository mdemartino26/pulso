import { addDays, daysBetween, movingAverage, type IsoDate } from "@/lib/calc";
import type { HabitRepository, WeightHistoryRepository, WellbeingRepository } from "@/server/repositories/tracking-types";
import type { TrendsRepository } from "@/server/repositories/trends-types";

/**
 * Tendencias: promedios y series por día o por semana. Los días sin
 * registros no cuentan como cero (no registrar no es "comer 0 kcal").
 */

export interface TrendsDeps {
  trends: TrendsRepository;
  weightHistory: WeightHistoryRepository;
  wellbeing: WellbeingRepository;
  habits: HabitRepository;
  today: () => Promise<IsoDate>;
}

export const RANGES = [7, 30, 90] as const;
export type TrendRange = (typeof RANGES)[number];

export function pickRange(raw: unknown): TrendRange {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (RANGES as readonly number[]).includes(n) ? (n as TrendRange) : 7;
}

export interface FallbackTargets {
  kcalTarget: number;
  proteinMinG: number;
  proteinMaxG: number;
  waterMl: number;
}

export interface TrendDay {
  date: IsoDate;
  /** null = no registró comidas ese día. */
  kcal: number | null;
  protein: number | null;
  kcalTarget: number;
  proteinMinG: number;
  waterGoalMl: number;
  exerciseKcal: number;
  minutes: number;
  steps: number | null;
  waterMl: number | null;
  weightKg: number | null;
  weightTrend: number | null;
  sleepHours: number | null;
  mood: number | null;
  habitsDone: number;
}

export interface SeriesPoint {
  /** Primer día del período (un día o una semana). */
  date: IsoDate;
  kcal: number | null;
  kcalTarget: number;
  minutes: number;
  sleepHours: number | null;
  waterMl: number | null;
  weightTrend: number | null;
}

export interface TrendSummary {
  days: number;
  food: { loggedDays: number; avgKcal: number | null; avgTarget: number; nearTargetDays: number; avgProtein: number | null; proteinDays: number };
  activity: { activeDays: number; weeklyMinutes: number; avgExerciseKcal: number; avgSteps: number | null };
  water: { loggedDays: number; avgMl: number | null; goalDays: number };
  weight: { first: number | null; last: number | null; change: number | null; weeklyRate: number | null };
  wellbeing: { avgSleep: number | null; sleepDays: number; avgMood: number | null };
  habits: { count: number; done: number; possible: number };
}

export interface Trends {
  range: TrendRange;
  from: IsoDate;
  to: IsoDate;
  days: TrendDay[];
  /** Por día (7 y 30) o por semana (90). */
  series: SeriesPoint[];
  grouping: "day" | "week";
  summary: TrendSummary;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const round = (v: number | null, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Agrupa valores por fecha (sumando). */
function sumByDate<T extends { date: IsoDate }>(rows: T[], pick: (r: T) => number) {
  const m = new Map<IsoDate, number>();
  for (const r of rows) m.set(r.date, (m.get(r.date) ?? 0) + pick(r));
  return m;
}

export async function getTrends(
  deps: TrendsDeps,
  userId: string,
  range: TrendRange,
  fallback: FallbackTargets,
): Promise<Trends> {
  const to = await deps.today();
  const from = addDays(to, -(range - 1));
  const [food, targets, activity, steps, water, weights, wellbeing, habits, checks] = await Promise.all([
    deps.trends.foodTotals(userId, from, to),
    // Metas guardadas desde antes del rango, para completar días sin meta propia.
    deps.trends.targets(userId, addDays(from, -60), to),
    deps.trends.activity(userId, from, to),
    deps.trends.steps(userId, from, to),
    deps.trends.water(userId, from, to),
    deps.weightHistory.list(userId, addDays(from, -6), to),
    deps.wellbeing.list(userId, from, to),
    deps.habits.list(userId),
    deps.habits.checks(userId, from, to),
  ]);

  const kcalBy = sumByDate(food, (r) => r.kcal);
  const proteinBy = sumByDate(food, (r) => r.protein);
  const exKcalBy = sumByDate(activity, (r) => r.kcal);
  const minutesBy = sumByDate(activity, (r) => r.minutes);
  const stepsBy = new Map(steps.map((s) => [s.date, s.steps]));
  const waterBy = sumByDate(water, (r) => r.ml);
  const wellBy = new Map(wellbeing.map((w) => [w.date, w]));
  const activeHabits = new Set(habits.map((h) => h.id));
  const habitsBy = sumByDate(
    checks.filter((c) => activeHabits.has(c.habitId)),
    () => 1,
  );
  const trend = movingAverage(weights.map((w) => ({ date: w.date, value: w.weightKg })), 7);
  const weightBy = new Map(trend.map((t) => [t.date, t]));
  const sortedTargets = [...targets].sort((a, b) => (a.date < b.date ? -1 : 1));

  const days: TrendDay[] = [];
  let t = 0;
  let currentTarget: FallbackTargets | null = null;
  for (let i = 0; i < range; i++) {
    const date = addDays(from, i);
    while (t < sortedTargets.length && sortedTargets[t]!.date <= date) currentTarget = sortedTargets[t++]!;
    const target = currentTarget ?? fallback;
    const w = weightBy.get(date);
    const well = wellBy.get(date);
    days.push({
      date,
      kcal: kcalBy.has(date) ? Math.round(kcalBy.get(date)!) : null,
      protein: proteinBy.has(date) ? Math.round(proteinBy.get(date)!) : null,
      kcalTarget: target.kcalTarget,
      proteinMinG: target.proteinMinG,
      waterGoalMl: target.waterMl,
      exerciseKcal: exKcalBy.get(date) ?? 0,
      minutes: minutesBy.get(date) ?? 0,
      steps: stepsBy.get(date) ?? null,
      waterMl: waterBy.get(date) ?? null,
      weightKg: w?.value ?? null,
      weightTrend: w?.average ?? null,
      sleepHours: well?.sleepHours ?? null,
      mood: well?.mood ?? null,
      habitsDone: habitsBy.get(date) ?? 0,
    });
  }

  const grouping = range === 90 ? "week" : "day";
  return { range, from, to, days, grouping, series: toSeries(days, grouping), summary: summarize(days, range, habits.length) };
}

function toSeries(days: TrendDay[], grouping: "day" | "week"): SeriesPoint[] {
  const size = grouping === "week" ? 7 : 1;
  const out: SeriesPoint[] = [];
  // Las semanas terminan hoy: el primer grupo puede quedar más corto.
  const firstSize = days.length % size || size;
  for (let start = 0; start < days.length; start += start === 0 ? firstSize : size) {
    const chunk = days.slice(start, start === 0 ? firstSize : start + size);
    const lastTrend = [...chunk].reverse().find((d) => d.weightTrend !== null)?.weightTrend ?? null;
    out.push({
      date: chunk[0]!.date,
      kcal: round(avg(chunk.flatMap((d) => (d.kcal === null ? [] : [d.kcal])))),
      kcalTarget: Math.round(avg(chunk.map((d) => d.kcalTarget)) ?? 0),
      minutes: grouping === "week" ? chunk.reduce((s, d) => s + d.minutes, 0) : chunk[0]!.minutes,
      sleepHours: round(avg(chunk.flatMap((d) => (d.sleepHours === null ? [] : [d.sleepHours]))), 1),
      waterMl: round(avg(chunk.flatMap((d) => (d.waterMl === null ? [] : [d.waterMl])))),
      weightTrend: lastTrend,
    });
  }
  return out;
}

function summarize(days: TrendDay[], range: number, habitCount: number): TrendSummary {
  const logged = days.filter((d) => d.kcal !== null);
  const nearTarget = logged.filter((d) => Math.abs(d.kcal! - d.kcalTarget) <= d.kcalTarget * 0.1).length;
  const waterDays = days.filter((d) => d.waterMl !== null);
  const sleepDays = days.filter((d) => d.sleepHours !== null);
  const moodDays = days.filter((d) => d.mood !== null);
  const stepDays = days.filter((d) => d.steps !== null);
  const withTrend = days.filter((d) => d.weightTrend !== null);
  const first = withTrend[0] ?? null;
  const last = withTrend.at(-1) ?? null;
  const change = first && last && first !== last ? round(last.weightTrend! - first.weightTrend!, 1) : null;
  const span = first && last ? daysBetween(first.date, last.date) : 0;

  return {
    days: range,
    food: {
      loggedDays: logged.length,
      avgKcal: round(avg(logged.map((d) => d.kcal!))),
      avgTarget: Math.round(avg((logged.length ? logged : days).map((d) => d.kcalTarget)) ?? 0),
      nearTargetDays: nearTarget,
      avgProtein: round(avg(logged.map((d) => d.protein!))),
      proteinDays: logged.filter((d) => d.protein! >= d.proteinMinG).length,
    },
    activity: {
      activeDays: days.filter((d) => d.minutes > 0).length,
      weeklyMinutes: Math.round((days.reduce((s, d) => s + d.minutes, 0) / range) * 7),
      avgExerciseKcal: Math.round(days.reduce((s, d) => s + d.exerciseKcal, 0) / range),
      avgSteps: round(avg(stepDays.map((d) => d.steps!))),
    },
    water: {
      loggedDays: waterDays.length,
      avgMl: round(avg(waterDays.map((d) => d.waterMl!))),
      goalDays: waterDays.filter((d) => d.waterMl! >= d.waterGoalMl).length,
    },
    weight: {
      first: first?.weightTrend ?? null,
      last: last?.weightTrend ?? null,
      change,
      weeklyRate: change !== null && span >= 6 ? round((change / span) * 7, 2) : null,
    },
    wellbeing: {
      avgSleep: round(avg(sleepDays.map((d) => d.sleepHours!)), 1),
      sleepDays: sleepDays.length,
      avgMood: round(avg(moodDays.map((d) => d.mood!)), 1),
    },
    habits: {
      count: habitCount,
      done: days.reduce((s, d) => s + d.habitsDone, 0),
      possible: habitCount * range,
    },
  };
}
