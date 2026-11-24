import { z } from "zod";
import {
  computeDailyTargets,
  dayActivity,
  isValidTimeZone,
  localDate,
  type DailyTargets,
  type DayActivity,
  type IsoDate,
} from "@/lib/calc";
import { makeProfileSchema, type ProfileInput } from "@/lib/validation/profile";
import {
  isCompleteProfile,
  type CompleteProfile,
  type DailyTargetsRepository,
  type ProfileRepository,
  type WeightRepository,
} from "@/server/repositories/types";

/**
 * Lógica del perfil. No conoce Supabase: recibe los repositorios por
 * parámetro (en producción los arma `profile-deps.ts`; en tests, fakes).
 */

export interface DayActivityLog {
  entries: { kcal: number; stepsIncluded: number }[];
  steps: number | null;
}

export interface ProfileDeps {
  profiles: ProfileRepository;
  weights: WeightRepository;
  targets: DailyTargetsRepository;
  now: () => Date;
  /** Ejercicio y pasos de un día (Etapa 6). Sin esto, se asume un día sin actividad. */
  activityLog?: (userId: string, date: IsoDate) => Promise<DayActivityLog>;
}

type CalcProfile = Pick<CompleteProfile, "sex" | "heightCm" | "activityLevel">;

/** Ejercicio y pasos del día, listos para la fórmula. */
async function activityFor(
  deps: ProfileDeps,
  userId: string,
  date: IsoDate,
  profile: CalcProfile,
  weightKg: number,
): Promise<DayActivity> {
  if (!deps.activityLog) return {};
  const log = await deps.activityLog(userId, date);
  return dayActivity({ ...log, weightKg, heightCm: profile.heightCm, sex: profile.sex, activityLevel: profile.activityLevel });
}

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export function todayFor(deps: Pick<ProfileDeps, "now">, timezone: string): IsoDate {
  return localDate(deps.now(), isValidTimeZone(timezone) ? timezone : DEFAULT_TZ);
}

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string[] | undefined> };

/**
 * Guarda el perfil (onboarding o edición). Valida TODO de nuevo en el
 * servidor, incluidos los límites de seguridad, aunque el formulario ya
 * lo haya hecho.
 */
export async function saveProfile(
  deps: ProfileDeps,
  userId: string,
  raw: Record<string, unknown>,
  mode: "onboarding" | "edit",
): Promise<SaveProfileResult> {
  const timezone = typeof raw.timezone === "string" ? raw.timezone : DEFAULT_TZ;
  const today = todayFor(deps, timezone);
  const parsed = makeProfileSchema({ today, requireHealthAck: mode === "onboarding" }).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  const current = await deps.profiles.get(userId);
  await deps.profiles.update(userId, {
    sex: input.sex,
    birthDate: input.birthDate,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
    timezone: input.timezone,
    goal: input.goal,
    weeklyRateKg: input.weeklyRateKg,
    waterGoalOverrideMl: mode === "edit" ? input.waterGoalOverrideMl : null,
    ...(current?.onboardingCompletedAt ? {} : { onboardingCompletedAt: deps.now().toISOString() }),
  });

  // El peso del formulario es el de hoy: guardarlo recalcula todo.
  const latest = await deps.weights.latestOnOrBefore(userId, today);
  if (!latest || latest.date !== today || latest.weightKg !== input.weightKg) {
    await deps.weights.upsert(userId, today, input.weightKg);
  }

  const activity = await activityFor(deps, userId, today, input, input.weightKg);
  await deps.targets.upsert(userId, today, targetsFromInput(input, today, activity));
  return { ok: true };
}

function targetsFromInput(input: ProfileInput, date: IsoDate, activity: DayActivity): DailyTargets {
  return computeDailyTargets(
    {
      sex: input.sex,
      birthDate: input.birthDate,
      heightCm: input.heightCm,
      activityLevel: input.activityLevel,
      goal: input.goal,
      weeklyRateKg: input.weeklyRateKg,
      waterGoalOverrideMl: input.waterGoalOverrideMl,
    },
    input.weightKg,
    date,
    activity,
  );
}

/**
 * Recalcula y guarda las metas de un día. Se llama cuando cambia el peso o
 * la actividad del día (Etapas 6 y 7).
 */
export async function recomputeTargets(
  deps: ProfileDeps,
  userId: string,
  date: IsoDate,
  activity?: DayActivity,
): Promise<DailyTargets | null> {
  const profile = await deps.profiles.get(userId);
  if (!isCompleteProfile(profile)) return null;
  const weight = await deps.weights.latestOnOrBefore(userId, date);
  if (!weight) return null;
  const dayAct = activity ?? (await activityFor(deps, userId, date, profile, weight.weightKg));
  const targets = computeDailyTargets(toCalcProfile(profile), weight.weightKg, date, dayAct);
  await deps.targets.upsert(userId, date, targets);
  return targets;
}

export interface ProfileOverview {
  profile: CompleteProfile;
  today: IsoDate;
  weightKg: number | null;
  targets: DailyTargets | null;
}

export async function getProfileOverview(deps: ProfileDeps, userId: string): Promise<ProfileOverview | null> {
  const profile = await deps.profiles.get(userId);
  if (!isCompleteProfile(profile)) return null;
  const today = todayFor(deps, profile.timezone);
  const weight = await deps.weights.latestOnOrBefore(userId, today);
  const targets = weight
    ? computeDailyTargets(
        toCalcProfile(profile),
        weight.weightKg,
        today,
        await activityFor(deps, userId, today, profile, weight.weightKg),
      )
    : null;
  return { profile, today, weightKg: weight?.weightKg ?? null, targets };
}

function toCalcProfile(p: CompleteProfile) {
  return {
    sex: p.sex,
    birthDate: p.birthDate,
    heightCm: p.heightCm,
    activityLevel: p.activityLevel,
    goal: p.goal,
    weeklyRateKg: p.weeklyRateKg,
    waterGoalOverrideMl: p.waterGoalOverrideMl,
  };
}

/** Datos para arrancar el onboarding (o null si ya está completo). */
export async function getOnboardingStart(
  deps: ProfileDeps,
  userId: string,
): Promise<{ today: IsoDate; timezone: string } | null> {
  const profile = await deps.profiles.get(userId);
  if (isCompleteProfile(profile)) return null;
  const timezone = profile && isValidTimeZone(profile.timezone) ? profile.timezone : DEFAULT_TZ;
  return { today: todayFor(deps, timezone), timezone };
}

/** Zonas horarias para el selector (incluye siempre la actual). */
export function timezoneOptions(current: string): string[] {
  const list = Intl.supportedValuesOf("timeZone");
  return list.includes(current) ? list : [current, ...list];
}
