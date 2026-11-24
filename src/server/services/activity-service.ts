import { z } from "zod";
import {
  addDays,
  estimatedOneRepMax,
  exerciseKcal,
  metFor,
  STRENGTH_ACTIVITY_SLUGS,
  stepsForActivity,
  type DailyTargets,
  type IsoDate,
} from "@/lib/calc";
import { addActivitySchema, stepsSchema, updateActivitySchema, type StrengthSetInput } from "@/lib/validation/activity";
import { uuidSchema } from "@/lib/validation/food";
import type {
  ActivityCatalogRepository,
  ActivityEntry,
  ActivityEntryRepository,
  Exercise,
  MetActivity,
  StepRepository,
  StrengthSet,
} from "@/server/repositories/activity-types";
import type { WeightRepository } from "@/server/repositories/types";

/**
 * Lógica de actividad física. No conoce Supabase: recibe repositorios.
 * Cada cambio recalcula la meta de ese día (más ejercicio = más margen).
 */

export interface ActivityDeps {
  catalog: ActivityCatalogRepository;
  entries: ActivityEntryRepository;
  steps: StepRepository;
  weights: WeightRepository;
  today: () => Promise<IsoDate>;
  /** Recalcula y guarda las metas del día (lo provee el servicio de perfil). */
  recomputeDay: (date: IsoDate) => Promise<DailyTargets | null>;
}

export type ActivityError = "invalid_input" | "not_found" | "date_out_of_range" | "no_weight";
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: ActivityError; fieldErrors?: Record<string, string[] | undefined> };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: ActivityError, fieldErrors?: Record<string, string[] | undefined>): Result<never> =>
  fieldErrors ? { ok: false, code, fieldErrors } : { ok: false, code };
const flat = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

const MAX_DAYS_BACK = 366;

async function checkDate(deps: ActivityDeps, date: IsoDate) {
  const today = await deps.today();
  return date <= today && date >= addDays(today, -MAX_DAYS_BACK);
}

/** Solo actividades de gimnasio de fuerza llevan series. */
const STRENGTH_SLUGS = new Set(STRENGTH_ACTIVITY_SLUGS);

function numberSets(sets: StrengthSetInput[]): StrengthSet[] {
  return sets.map((s, i) => ({ exerciseId: s.exerciseId, setNumber: i + 1, reps: s.reps, weightKg: s.weightKg }));
}

/** Calcula MET, calorías y pasos incluidos con los datos de la base (nunca del cliente). */
async function buildEntry(
  deps: ActivityDeps,
  userId: string,
  date: IsoDate,
  input: { metActivityId: number; intensity: ActivityEntry["intensity"]; durationMin: number; sets: StrengthSetInput[] },
): Promise<Result<Omit<ActivityEntry, "id">>> {
  const [activities, exercises, weight] = await Promise.all([
    deps.catalog.activities(),
    input.sets.length > 0 ? deps.catalog.exercises() : Promise.resolve([] as Exercise[]),
    deps.weights.latestOnOrBefore(userId, date),
  ]);
  const activity = activities.find((a) => a.id === input.metActivityId);
  if (!activity) return fail("invalid_input", { metActivityId: ["Elegí una actividad de la lista"] });
  if (input.sets.length > 0) {
    if (!STRENGTH_SLUGS.has(activity.slug)) return fail("invalid_input", { sets: ["Esta actividad no lleva series"] });
    const valid = new Set(exercises.map((e) => e.id));
    if (input.sets.some((s) => !valid.has(s.exerciseId))) return fail("invalid_input", { sets: ["Elegí ejercicios de la lista"] });
  }
  if (!weight) return fail("no_weight");

  const met = metFor(activity, input.intensity);
  return ok({
    date,
    metActivityId: activity.id,
    intensity: input.intensity,
    durationMin: input.durationMin,
    metValue: met,
    kcal: Math.min(5000, exerciseKcal({ met, weightKg: weight.weightKg, durationMin: input.durationMin })),
    stepsIncluded: stepsForActivity(met, input.intensity, input.durationMin, activity.isAmbulatory),
    sets: numberSets(input.sets),
  });
}

export async function addActivity(deps: ActivityDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = addActivitySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const input = parsed.data;
  if (!(await checkDate(deps, input.date))) return fail("date_out_of_range");
  const entry = await buildEntry(deps, userId, input.date, input);
  if (!entry.ok) return entry;
  await deps.entries.insert(userId, entry.value);
  await deps.recomputeDay(input.date);
  return ok({ date: input.date });
}

export async function updateActivity(deps: ActivityDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = updateActivitySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const input = parsed.data;
  const current = await deps.entries.get(userId, input.entryId);
  if (!current) return fail("not_found");
  const entry = await buildEntry(deps, userId, current.date, input);
  if (!entry.ok) return entry;
  if (!(await deps.entries.update(userId, current.id, entry.value))) return fail("not_found");
  await deps.recomputeDay(current.date);
  return ok({ date: current.date });
}

export async function deleteActivity(deps: ActivityDeps, userId: string, rawId: unknown): Promise<Result<{ date: IsoDate }>> {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return fail("invalid_input");
  const current = await deps.entries.get(userId, id.data);
  if (!current || !(await deps.entries.remove(userId, current.id))) return fail("not_found");
  await deps.recomputeDay(current.date);
  return ok({ date: current.date });
}

export async function saveSteps(deps: ActivityDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = stepsSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const { date, steps } = parsed.data;
  if (!(await checkDate(deps, date))) return fail("date_out_of_range");
  await deps.steps.upsert(userId, date, steps);
  await deps.recomputeDay(date);
  return ok({ date });
}

// --- Lecturas -------------------------------------------------------------------

export interface ActivityView extends ActivityEntry {
  activity: MetActivity | null;
  setsWithNames: (StrengthSet & { exerciseName: string })[];
}

export interface ActivityDay {
  date: IsoDate;
  entries: ActivityView[];
  steps: number | null;
  exerciseKcal: number;
  minutes: number;
}

export async function getActivityDay(deps: ActivityDeps, userId: string, date: IsoDate): Promise<ActivityDay> {
  const [entries, steps, activities, exercises] = await Promise.all([
    deps.entries.listByDate(userId, date),
    deps.steps.get(userId, date),
    deps.catalog.activities(),
    deps.catalog.exercises(),
  ]);
  const exName = new Map(exercises.map((e) => [e.id, e.name]));
  return {
    date,
    entries: entries.map((e) => ({
      ...e,
      activity: activities.find((a) => a.id === e.metActivityId) ?? null,
      setsWithNames: e.sets.map((s) => ({ ...s, exerciseName: exName.get(s.exerciseId) ?? "Ejercicio" })),
    })),
    steps,
    exerciseKcal: entries.reduce((s, e) => s + e.kcal, 0),
    minutes: entries.reduce((s, e) => s + e.durationMin, 0),
  };
}

export async function getActivityEntry(deps: ActivityDeps, userId: string, rawId: unknown) {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return null;
  return deps.entries.get(userId, id.data);
}

export interface StrengthSession {
  date: IsoDate;
  entryId: string;
  /** En el orden en que se hicieron. */
  sets: { reps: number; weightKg: number }[];
  bestSet: { reps: number; weightKg: number };
  estimatedOneRepMax: number;
  volumeKg: number;
}

/** Historial de un ejercicio agrupado por sesión (la más nueva primero). */
export async function getStrengthHistory(
  deps: ActivityDeps,
  userId: string,
  rawExerciseId: unknown,
): Promise<{ exercise: Exercise; sessions: StrengthSession[] } | null> {
  const id = z.coerce.number().int().min(1).max(32767).safeParse(rawExerciseId);
  if (!id.success) return null;
  const exercise = (await deps.catalog.exercises()).find((e) => e.id === id.data);
  if (!exercise) return null;
  const rows = await deps.entries.strengthHistory(userId, exercise.id, 500);
  const byEntry = new Map<string, StrengthSession>();
  const ordered = [...rows].sort((a, b) => a.setNumber - b.setNumber);
  for (const r of ordered) {
    const s = byEntry.get(r.entryId) ?? {
      date: r.date,
      entryId: r.entryId,
      sets: [],
      bestSet: { reps: 0, weightKg: 0 },
      estimatedOneRepMax: 0,
      volumeKg: 0,
    };
    s.sets.push({ reps: r.reps, weightKg: r.weightKg });
    s.volumeKg = Math.round((s.volumeKg + r.reps * r.weightKg) * 10) / 10;
    const e1rm = estimatedOneRepMax(r.weightKg, r.reps);
    if (e1rm > s.estimatedOneRepMax || (e1rm === s.estimatedOneRepMax && r.reps > s.bestSet.reps)) {
      s.estimatedOneRepMax = e1rm;
      s.bestSet = { reps: r.reps, weightKg: r.weightKg };
    }
    byEntry.set(r.entryId, s);
  }
  const sessions = [...byEntry.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { exercise, sessions };
}

export async function getTrainedExercises(deps: ActivityDeps, userId: string): Promise<Exercise[]> {
  const [ids, exercises] = await Promise.all([deps.entries.trainedExerciseIds(userId), deps.catalog.exercises()]);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
