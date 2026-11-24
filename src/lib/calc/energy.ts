import {
  ACTIVITY_FACTORS,
  BASELINE_STEPS,
  STRIDE_FRACTION,
  WALKING_NET_KCAL_PER_KG_KM,
} from "./constants";
import type { ActivityLevel, Sex } from "./types";

export interface ExerciseInput {
  met: number;
  weightKg: number;
  durationMin: number;
}

/**
 * Calorías de ejercicio POR ENCIMA del basal: (MET − 1) × kg × horas.
 * Restar 1 MET evita contar dos veces el basal, que ya está en el gasto.
 */
export function exerciseKcal({ met, weightKg, durationMin }: ExerciseInput): number {
  if (met <= 1 || durationMin <= 0 || weightKg <= 0) return 0;
  return Math.round((met - 1) * weightKg * (durationMin / 60));
}

export interface StepsInput {
  steps: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  /** Pasos que ya están dentro de una caminata/carrera registrada. */
  stepsInActivities?: number;
}

/** Pasos que efectivamente suman calorías (descontando base y actividades). */
export function countableSteps({
  steps,
  activityLevel,
  stepsInActivities = 0,
}: Pick<StepsInput, "steps" | "activityLevel" | "stepsInActivities">): number {
  return Math.max(0, steps - stepsInActivities - BASELINE_STEPS[activityLevel]);
}

/** Calorías netas de los pasos extra, estimadas por distancia (largo de paso según altura). */
export function stepsKcal(input: StepsInput): number {
  const steps = countableSteps(input);
  if (steps === 0) return 0;
  const strideM = (input.heightCm * STRIDE_FRACTION[input.sex]) / 100;
  const km = (steps * strideM) / 1000;
  return Math.round(WALKING_NET_KCAL_PER_KG_KM * input.weightKg * km);
}

export interface ExpenditureInput {
  bmr: number;
  activityLevel: ActivityLevel;
  exerciseKcal?: number;
  stepsKcal?: number;
}

/** Gasto del día = BMR × factor de actividad + ejercicio + pasos extra. */
export function dailyExpenditure({
  bmr,
  activityLevel,
  exerciseKcal: exercise = 0,
  stepsKcal: steps = 0,
}: ExpenditureInput): number {
  return bmr * ACTIVITY_FACTORS[activityLevel] + exercise + steps;
}
