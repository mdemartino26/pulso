import {
  KCAL_PER_KG,
  MAX_WEEKLY_GAIN_KG,
  MAX_WEEKLY_LOSS_FRACTION,
  MIN_DAILY_KCAL,
  WEEKLY_RATE_OPTIONS,
} from "./constants";
import type { Goal, Sex } from "./types";

/** Diferencia diaria de energía para un ritmo semanal (siempre positiva). */
export function dailyEnergyDelta(weeklyRateKg: number): number {
  return (weeklyRateKg * KCAL_PER_KG) / 7;
}

export function maxWeeklyLossKg(weightKg: number): number {
  return weightKg * MAX_WEEKLY_LOSS_FRACTION;
}

export interface TargetInput {
  tdee: number;
  sex: Sex;
  goal: Goal;
  weeklyRateKg: number;
}

export interface CalorieTarget {
  /** Meta final, redondeada y nunca debajo del piso. */
  kcal: number;
  /** Lo que daría la cuenta sin el piso. */
  requestedKcal: number;
  /** true si se aplicó el piso de 1200/1500 kcal. */
  floorApplied: boolean;
}

/** Meta calórica = gasto − déficit (o + superávit), con piso de seguridad. */
export function calorieTarget({ tdee, sex, goal, weeklyRateKg }: TargetInput): CalorieTarget {
  const delta = goal === "maintain" ? 0 : dailyEnergyDelta(weeklyRateKg);
  const requested = goal === "lose" ? tdee - delta : goal === "gain" ? tdee + delta : tdee;
  const floor = MIN_DAILY_KCAL[sex];
  const requestedKcal = Math.round(requested);
  return requestedKcal < floor
    ? { kcal: floor, requestedKcal, floorApplied: true }
    : { kcal: requestedKcal, requestedKcal, floorApplied: false };
}

export type SafetyIssue = "rate_above_max" | "below_min_kcal";

export interface SafetyCheckInput {
  sex: Sex;
  weightKg: number;
  goal: Goal;
  weeklyRateKg: number;
  /** Gasto de un día sin ejercicio (BMR × factor de actividad). */
  baseTdee: number;
}

export interface SafetyCheck {
  ok: boolean;
  issues: SafetyIssue[];
  /** Ritmo más alto de las opciones que respeta ambos límites (null si ninguno). */
  suggestedRateKg: number | null;
}

/**
 * Límites de seguridad para un objetivo:
 * - Bajar: no más de 1 % del peso por semana, y que la meta de un día sin
 *   ejercicio no quede debajo de 1200 (mujeres) / 1500 (hombres) kcal.
 * - Subir: no más de 0,5 kg por semana.
 */
export function checkGoalSafety(input: SafetyCheckInput): SafetyCheck {
  const { goal, weeklyRateKg } = input;
  if (goal === "maintain") return { ok: true, issues: [], suggestedRateKg: null };

  const issues = issuesFor(input, weeklyRateKg);
  const allowed = WEEKLY_RATE_OPTIONS.filter((rate) => issuesFor(input, rate).length === 0);
  const suggestedRateKg = allowed.length ? Math.max(...allowed) : null;
  return { ok: issues.length === 0, issues, suggestedRateKg };
}

function issuesFor(input: SafetyCheckInput, rate: number): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  if (input.goal === "gain") {
    if (rate > MAX_WEEKLY_GAIN_KG) issues.push("rate_above_max");
    return issues;
  }
  // Pequeña tolerancia para errores de punto flotante.
  if (rate > maxWeeklyLossKg(input.weightKg) + 1e-9) issues.push("rate_above_max");
  if (Math.round(input.baseTdee - dailyEnergyDelta(rate)) < MIN_DAILY_KCAL[input.sex]) {
    issues.push("below_min_kcal");
  }
  return issues;
}
