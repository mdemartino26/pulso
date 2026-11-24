import { describe, expect, it } from "vitest";
import {
  addDays,
  ageOn,
  bmrMifflinStJeor,
  calorieTarget,
  checkGoalSafety,
  computeDailyTargets,
  countableSteps,
  dailyEnergyDelta,
  dailyExpenditure,
  daysBetween,
  exerciseKcal,
  isValidTimeZone,
  localDate,
  maxWeeklyLossKg,
  movingAverage,
  parseIsoDate,
  proteinRangeG,
  stepsKcal,
  waterGoalMl,
} from "./index";

describe("BMR (Mifflin-St Jeor)", () => {
  it("mujer: 10×70 + 6,25×165 − 5×36 − 161 = 1390,25", () => {
    expect(bmrMifflinStJeor({ sex: "female", weightKg: 70, heightCm: 165, ageYears: 36 })).toBe(1390.25);
  });
  it("hombre: 10×80 + 6,25×180 − 5×30 + 5 = 1780", () => {
    expect(bmrMifflinStJeor({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 })).toBe(1780);
  });
  it("la diferencia entre sexos es siempre 166 kcal", () => {
    const base = { weightKg: 65, heightCm: 170, ageYears: 40 };
    expect(
      bmrMifflinStJeor({ ...base, sex: "male" }) - bmrMifflinStJeor({ ...base, sex: "female" }),
    ).toBe(166);
  });
});

describe("edad y fechas", () => {
  it("la edad cambia el día del cumpleaños", () => {
    expect(ageOn("1990-05-01", "2026-04-30")).toBe(35);
    expect(ageOn("1990-05-01", "2026-05-01")).toBe(36);
  });
  it("nacidos un 29 de febrero cumplen el 1 de marzo en años no bisiestos", () => {
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("2000-02-29", "2026-03-01")).toBe(26);
  });
  it("rechaza fechas que no existen", () => {
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseIsoDate("24/11/2026")).toThrow(RangeError);
  });
  it("suma días y cuenta diferencias cruzando meses y años", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-24", "2026-12-01")).toBe(7);
  });
  it("el día del registro es el de la zona horaria del usuario", () => {
    const instant = new Date("2026-11-25T02:30:00Z"); // 23:30 del 24/11 en Argentina
    expect(localDate(instant, "America/Argentina/Buenos_Aires")).toBe("2026-11-24");
    expect(localDate(instant, "UTC")).toBe("2026-11-25");
    expect(localDate(instant, "Europe/Madrid")).toBe("2026-11-25");
  });
  it("valida zonas horarias", () => {
    expect(isValidTimeZone("America/Argentina/Cordoba")).toBe(true);
    expect(isValidTimeZone("Marte/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("calorías de ejercicio (MET − 1)", () => {
  it("MET 8 durante 1 h con 70 kg → 7 × 70 = 490 kcal", () => {
    expect(exerciseKcal({ met: 8, weightKg: 70, durationMin: 60 })).toBe(490);
  });
  it("MET 3,5 durante 30 min con 80 kg → 2,5 × 80 × 0,5 = 100 kcal", () => {
    expect(exerciseKcal({ met: 3.5, weightKg: 80, durationMin: 30 })).toBe(100);
  });
  it("MET 1 (reposo) o duración 0 no suman nada", () => {
    expect(exerciseKcal({ met: 1, weightKg: 70, durationMin: 60 })).toBe(0);
    expect(exerciseKcal({ met: 6, weightKg: 70, durationMin: 0 })).toBe(0);
  });
});

describe("pasos", () => {
  const base = { weightKg: 70, heightCm: 165, sex: "female" as const, activityLevel: "sedentary" as const };

  it("solo cuentan los pasos por encima de la base del nivel de actividad", () => {
    expect(countableSteps({ steps: 10000, activityLevel: "sedentary" })).toBe(6000);
    expect(countableSteps({ steps: 10000, activityLevel: "high" })).toBe(0);
    expect(stepsKcal({ ...base, steps: 3000 })).toBe(0);
  });
  it("estima por distancia: 6000 pasos × 0,681 m × 0,5 kcal/kg/km × 70 kg ≈ 143 kcal", () => {
    expect(stepsKcal({ ...base, steps: 10000 })).toBe(143);
  });
  it("no cuenta dos veces los pasos de una caminata ya registrada", () => {
    expect(stepsKcal({ ...base, steps: 10000, stepsInActivities: 3000 })).toBe(72);
    expect(stepsKcal({ ...base, steps: 10000, stepsInActivities: 9000 })).toBe(0);
  });
});

describe("gasto diario", () => {
  it("BMR × factor + ejercicio + pasos", () => {
    expect(
      dailyExpenditure({ bmr: 1390.25, activityLevel: "light", exerciseKcal: 300, stepsKcal: 100 }),
    ).toBeCloseTo(1390.25 * 1.375 + 400, 6);
  });
  it("sin actividad registrada es BMR × factor", () => {
    expect(dailyExpenditure({ bmr: 1780, activityLevel: "sedentary" })).toBeCloseTo(2136, 6);
  });
});

describe("meta calórica", () => {
  it("0,5 kg/semana ≈ 550 kcal de déficit diario (7700 kcal/kg)", () => {
    expect(dailyEnergyDelta(0.5)).toBe(550);
    expect(calorieTarget({ tdee: 2000, sex: "female", goal: "lose", weeklyRateKg: 0.5 })).toEqual({
      kcal: 1450,
      requestedKcal: 1450,
      floorApplied: false,
    });
  });
  it("mantener = gasto; subir suma el superávit", () => {
    expect(calorieTarget({ tdee: 2200, sex: "male", goal: "maintain", weeklyRateKg: 0 }).kcal).toBe(2200);
    expect(calorieTarget({ tdee: 2200, sex: "male", goal: "gain", weeklyRateKg: 0.25 }).kcal).toBe(2475);
  });
  it("nunca baja de 1500 kcal en hombres", () => {
    expect(calorieTarget({ tdee: 1900, sex: "male", goal: "lose", weeklyRateKg: 0.75 })).toEqual({
      kcal: 1500,
      requestedKcal: 1075,
      floorApplied: true,
    });
  });
  it("nunca baja de 1200 kcal en mujeres", () => {
    const t = calorieTarget({ tdee: 1500, sex: "female", goal: "lose", weeklyRateKg: 0.5 });
    expect(t.kcal).toBe(1200);
    expect(t.floorApplied).toBe(true);
  });
});

describe("límites de seguridad", () => {
  it("el ritmo máximo de pérdida es 1 % del peso por semana", () => {
    expect(maxWeeklyLossKg(60)).toBeCloseTo(0.6, 9);
  });

  it("rechaza un ritmo mayor al 1 % del peso", () => {
    const r = checkGoalSafety({ sex: "female", weightKg: 60, goal: "lose", weeklyRateKg: 0.75, baseTdee: 2600 });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("rate_above_max");
    expect(r.suggestedRateKg).toBe(0.5);
  });

  it("rechaza un ritmo que deja la meta debajo del piso y sugiere uno posible", () => {
    // Mujer 70 kg, 165 cm, 36 años, sedentaria: 1390,25 × 1,2 ≈ 1668 kcal.
    const r = checkGoalSafety({ sex: "female", weightKg: 70, goal: "lose", weeklyRateKg: 0.5, baseTdee: 1668.3 });
    expect(r.issues).toEqual(["below_min_kcal"]);
    expect(r.suggestedRateKg).toBe(0.25);
  });

  it("acepta 1 kg/semana cuando el peso y el gasto lo permiten", () => {
    const r = checkGoalSafety({ sex: "male", weightKg: 100, goal: "lose", weeklyRateKg: 1, baseTdee: 3069 });
    expect(r).toEqual({ ok: true, issues: [], suggestedRateKg: 1 });
  });

  it("si ningún ritmo es seguro, no sugiere ninguno", () => {
    const r = checkGoalSafety({ sex: "female", weightKg: 45, goal: "lose", weeklyRateKg: 0.25, baseTdee: 1111.8 });
    expect(r.ok).toBe(false);
    expect(r.suggestedRateKg).toBeNull();
  });

  it("subir de peso: máximo 0,5 kg/semana", () => {
    const r = checkGoalSafety({ sex: "male", weightKg: 70, goal: "gain", weeklyRateKg: 0.75, baseTdee: 2500 });
    expect(r.issues).toEqual(["rate_above_max"]);
    expect(r.suggestedRateKg).toBe(0.5);
  });

  it("mantener siempre es seguro", () => {
    expect(checkGoalSafety({ sex: "female", weightKg: 45, goal: "maintain", weeklyRateKg: 0, baseTdee: 1100 }).ok).toBe(true);
  });
});

describe("proteína", () => {
  it("en déficit: 1,6–2,2 g por kg", () => {
    expect(proteinRangeG(70, "lose")).toEqual({ min: 112, max: 154 });
  });
});

describe("agua", () => {
  it("35 ml × kg, redondeado a 50 ml", () => {
    expect(waterGoalMl({ weightKg: 70, hadExercise: false })).toBe(2450);
    expect(waterGoalMl({ weightKg: 71, hadExercise: false })).toBe(2500);
  });
  it("+500 ml en días con ejercicio", () => {
    expect(waterGoalMl({ weightKg: 70, hadExercise: true })).toBe(2950);
  });
  it("mínimo sugerido 2 L", () => {
    expect(waterGoalMl({ weightKg: 50, hadExercise: false })).toBe(2000);
  });
  it("la meta elegida a mano tiene prioridad", () => {
    expect(waterGoalMl({ weightKg: 70, hadExercise: true, overrideMl: 1800 })).toBe(1800);
  });
});

describe("promedio móvil de 7 días", () => {
  it("promedia los registros de la ventana", () => {
    const t = movingAverage([
      { date: "2026-11-03", value: 81 },
      { date: "2026-11-01", value: 80 },
      { date: "2026-11-02", value: 79 },
    ]);
    expect(t.map((p) => p.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(t.map((p) => p.average)).toEqual([80, 79.5, 80]);
  });
  it("usa días de calendario: con huecos promedia solo lo que entra en la ventana", () => {
    const t = movingAverage([
      { date: "2026-11-01", value: 80 },
      { date: "2026-11-07", value: 78 }, // 6 días después: entra
      { date: "2026-11-08", value: 76 }, // 7 días después del 1/11: el 1/11 ya no entra
    ]);
    expect(t.map((p) => p.average)).toEqual([80, 79, 77]);
  });
  it("lista vacía → vacía", () => {
    expect(movingAverage([])).toEqual([]);
  });
});

describe("metas del día (todo junto)", () => {
  const profile = {
    sex: "female" as const,
    birthDate: "1990-05-01",
    heightCm: 165,
    activityLevel: "light" as const,
    goal: "lose" as const,
    weeklyRateKg: 0.5,
  };

  it("día sin ejercicio", () => {
    expect(computeDailyTargets(profile, 70, "2026-11-24")).toEqual({
      bmrKcal: 1390,
      tdeeKcal: 1912, // 1390,25 × 1,375
      kcalTarget: 1362, // 1911,59 − 550
      floorApplied: false,
      proteinMinG: 112,
      proteinMaxG: 154,
      waterMl: 2450,
    });
  });

  it("el ejercicio sube el gasto, la meta y el agua", () => {
    const t = computeDailyTargets(profile, 70, "2026-11-24", { exerciseKcal: 300, hadExercise: true });
    expect(t.tdeeKcal).toBe(2212);
    expect(t.kcalTarget).toBe(1662);
    expect(t.waterMl).toBe(2950);
  });

  it("al cambiar el peso se recalcula todo", () => {
    const t = computeDailyTargets(profile, 68, "2026-11-24");
    expect(t.bmrKcal).toBe(1370);
    expect(t.waterMl).toBe(2400); // 68 × 35 = 2380 → 2400
  });
});
