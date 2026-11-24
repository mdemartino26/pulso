import { stepsKcal } from "./energy";
import type { DayActivity } from "./daily-targets";
import type { ActivityLevel, Sex } from "./types";

export type Intensity = "low" | "moderate" | "high";

export interface MetRow {
  metLow: number;
  metModerate: number;
  metHigh: number;
  isAmbulatory: boolean;
}

export function metFor(activity: MetRow, intensity: Intensity): number {
  return intensity === "low" ? activity.metLow : intensity === "high" ? activity.metHigh : activity.metModerate;
}

/**
 * Pasos aproximados de una caminata o carrera, para descontarlos de los
 * pasos del día (si no, se contarían dos veces). Cadencias típicas:
 * caminar 90–120 pasos/min, correr ~160.
 */
export function stepsForActivity(met: number, intensity: Intensity, durationMin: number, isAmbulatory: boolean): number {
  if (!isAmbulatory || durationMin <= 0) return 0;
  const cadence = met >= 6 ? 160 : intensity === "low" ? 90 : intensity === "high" ? 120 : 105;
  return Math.min(100000, Math.round(cadence * durationMin));
}

export interface DayActivityInput {
  entries: { kcal: number; stepsIncluded: number }[];
  steps: number | null;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  activityLevel: ActivityLevel;
}

/** Junta el ejercicio y los pasos de un día para calcular la meta. */
export function dayActivity(input: DayActivityInput): DayActivity {
  const exercise = input.entries.reduce((s, e) => s + e.kcal, 0);
  const stepsInActivities = input.entries.reduce((s, e) => s + e.stepsIncluded, 0);
  const steps = input.steps
    ? stepsKcal({
        steps: input.steps,
        stepsInActivities,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        sex: input.sex,
        activityLevel: input.activityLevel,
      })
    : 0;
  return { exerciseKcal: exercise, stepsKcal: steps, hadExercise: input.entries.length > 0 };
}

/** 1RM estimado (fórmula de Epley). Sirve para comparar sesiones, no como récord real. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Actividades de gimnasio que admiten series de fuerza (slugs de `met_activities`). */
export const STRENGTH_ACTIVITY_SLUGS: readonly string[] = ["pesas", "calistenia", "circuito_hiit"];
