import type { ActivityLevel, Goal, Sex } from "./types";

/** ≈ kcal por kg de tejido graso. Es una aproximación clásica (Wishnofsky). */
export const KCAL_PER_KG = 7700;

/** Piso de seguridad de la meta calórica diaria. */
export const MIN_DAILY_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

/** Ritmo máximo de pérdida: 1 % del peso corporal por semana. */
export const MAX_WEEKLY_LOSS_FRACTION = 0.01;

/** Ritmos que puede elegir el usuario (kg por semana). */
export const WEEKLY_RATE_OPTIONS = [0.25, 0.5, 0.75, 1] as const;
/** Subir de peso más rápido que esto suele ser mayormente grasa. */
export const MAX_WEEKLY_GAIN_KG = 0.5;

/** Factor de actividad base (sin el ejercicio que se registra aparte). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

/**
 * Pasos que el factor de actividad ya da por incluidos. Solo los pasos por
 * encima de esta base suman calorías: si no, alguien "moderado" que camina
 * 8000 pasos contaría esas calorías dos veces.
 */
export const BASELINE_STEPS: Record<ActivityLevel, number> = {
  sedentary: 4000,
  light: 6000,
  moderate: 8000,
  high: 10000,
};

/** Costo neto de caminar (≈ MET 3,5 − 1 a 5 km/h): kcal por kg por km. */
export const WALKING_NET_KCAL_PER_KG_KM = 0.5;

/** Largo del paso como fracción de la altura. */
export const STRIDE_FRACTION: Record<Sex, number> = { female: 0.413, male: 0.415 };

/** Proteína sugerida (g por kg de peso corporal). */
export const PROTEIN_G_PER_KG: Record<Goal, { min: number; max: number }> = {
  lose: { min: 1.6, max: 2.2 },
  maintain: { min: 1.2, max: 2.0 },
  gain: { min: 1.6, max: 2.0 },
};

export const WATER_ML_PER_KG = 35;
export const WATER_EXERCISE_BONUS_ML = 500;
export const WATER_MIN_ML = 2000;
