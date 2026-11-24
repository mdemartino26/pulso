import { bmrMifflinStJeor } from "./bmr";
import { ageOn } from "./dates";
import { dailyExpenditure } from "./energy";
import { calorieTarget } from "./goals";
import { proteinRangeG, waterGoalMl } from "./nutrition";
import type { ActivityLevel, Goal, IsoDate, Sex } from "./types";

export interface ProfileForTargets {
  sex: Sex;
  birthDate: IsoDate;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  weeklyRateKg: number;
  waterGoalOverrideMl?: number | null | undefined;
}

export interface DayActivity {
  exerciseKcal?: number;
  stepsKcal?: number;
  hadExercise?: boolean;
}

export interface DailyTargets {
  bmrKcal: number;
  tdeeKcal: number;
  kcalTarget: number;
  floorApplied: boolean;
  proteinMinG: number;
  proteinMaxG: number;
  waterMl: number;
}

/** Junta todos los cálculos para un día. Enteros, listos para guardar. */
export function computeDailyTargets(
  profile: ProfileForTargets,
  weightKg: number,
  date: IsoDate,
  activity: DayActivity = {},
): DailyTargets {
  const bmr = bmrMifflinStJeor({
    sex: profile.sex,
    weightKg,
    heightCm: profile.heightCm,
    ageYears: ageOn(profile.birthDate, date),
  });
  const tdee = dailyExpenditure({
    bmr,
    activityLevel: profile.activityLevel,
    exerciseKcal: activity.exerciseKcal ?? 0,
    stepsKcal: activity.stepsKcal ?? 0,
  });
  const target = calorieTarget({
    tdee,
    sex: profile.sex,
    goal: profile.goal,
    weeklyRateKg: profile.weeklyRateKg,
  });
  const protein = proteinRangeG(weightKg, profile.goal);
  return {
    bmrKcal: Math.round(bmr),
    tdeeKcal: Math.round(tdee),
    kcalTarget: target.kcal,
    floorApplied: target.floorApplied,
    proteinMinG: protein.min,
    proteinMaxG: protein.max,
    waterMl: waterGoalMl({
      weightKg,
      hadExercise: activity.hadExercise ?? false,
      overrideMl: profile.waterGoalOverrideMl,
    }),
  };
}
