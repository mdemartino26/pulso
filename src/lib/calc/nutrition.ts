import {
  PROTEIN_G_PER_KG,
  WATER_EXERCISE_BONUS_ML,
  WATER_MIN_ML,
  WATER_ML_PER_KG,
} from "./constants";
import type { Goal } from "./types";

/** Proteína sugerida en gramos por día (1,6–2,2 g/kg en déficit). */
export function proteinRangeG(weightKg: number, goal: Goal): { min: number; max: number } {
  const perKg = PROTEIN_G_PER_KG[goal];
  return { min: Math.round(weightKg * perKg.min), max: Math.round(weightKg * perKg.max) };
}

export interface WaterInput {
  weightKg: number;
  hadExercise: boolean;
  /** Meta elegida a mano por el usuario (gana sobre la calculada). */
  overrideMl?: number | null | undefined;
}

/** Meta de agua: 35 ml × kg (+500 ml si hubo ejercicio), mínimo 2 L. Redondeada a 50 ml. */
export function waterGoalMl({ weightKg, hadExercise, overrideMl }: WaterInput): number {
  if (overrideMl != null) return overrideMl;
  const raw = weightKg * WATER_ML_PER_KG + (hadExercise ? WATER_EXERCISE_BONUS_ML : 0);
  return Math.max(WATER_MIN_ML, Math.round(raw / 50) * 50);
}
