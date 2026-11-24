import type { Sex } from "./types";

export interface BmrInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}

/**
 * Metabolismo basal con Mifflin-St Jeor (kcal/día).
 *   Hombre: 10×peso + 6,25×altura − 5×edad + 5
 *   Mujer:  10×peso + 6,25×altura − 5×edad − 161
 */
export function bmrMifflinStJeor({ sex, weightKg, heightCm, ageYears }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return base + (sex === "male" ? 5 : -161);
}
