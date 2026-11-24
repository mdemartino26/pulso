import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/calc";
import { getTrends, pickRange, type TrendsDeps } from "./trends-service";

const U = "u1";
const TODAY = "2026-11-24";
const FALLBACK = { kcalTarget: 1500, proteinMinG: 100, proteinMaxG: 140, waterMl: 2500 };

function deps(over: Partial<{ [K in keyof TrendsDeps["trends"]]: Awaited<ReturnType<TrendsDeps["trends"][K]>> }> = {}, extra: Partial<TrendsDeps> = {}): TrendsDeps {
  return {
    trends: {
      foodTotals: async () => over.foodTotals ?? [],
      targets: async () => over.targets ?? [],
      activity: async () => over.activity ?? [],
      steps: async () => over.steps ?? [],
      water: async () => over.water ?? [],
    },
    weightHistory: { list: async () => [], remove: async () => false, count: async () => 0 },
    wellbeing: { get: async () => null, list: async () => [], upsert: async () => {} },
    habits: { list: async () => [], create: async () => "", rename: async () => false, archive: async () => false, checks: async () => [], setCheck: async () => {} },
    today: async () => TODAY,
    ...extra,
  };
}

describe("getTrends", () => {
  it("los días sin registros no cuentan como cero", async () => {
    const t = await getTrends(
      deps({
        foodTotals: [
          { date: TODAY, kcal: 1000, protein: 60 },
          { date: TODAY, kcal: 500, protein: 50 },
          { date: addDays(TODAY, -1), kcal: 1800, protein: 90 },
        ],
      }),
      U,
      7,
      FALLBACK,
    );
    expect(t.days).toHaveLength(7);
    expect(t.days[0]!.date).toBe("2026-11-18");
    expect(t.summary.food).toMatchObject({ loggedDays: 2, avgKcal: 1650, nearTargetDays: 1, avgProtein: 100, proteinDays: 1 });
  });

  it("usa la meta guardada más cercana hacia atrás, o la actual", async () => {
    const t = await getTrends(
      deps({ targets: [{ date: "2026-11-01", kcalTarget: 1400, proteinMinG: 90, proteinMaxG: 130, waterMl: 2300 }, { date: "2026-11-22", kcalTarget: 1600, proteinMinG: 90, proteinMaxG: 130, waterMl: 2800 }] }),
      U,
      7,
      FALLBACK,
    );
    expect(t.days.map((d) => d.kcalTarget)).toEqual([1400, 1400, 1400, 1400, 1600, 1600, 1600]);
    const none = await getTrends(deps(), U, 7, FALLBACK);
    expect(none.days[0]!.kcalTarget).toBe(1500);
  });

  it("resume actividad, agua, sueño y hábitos", async () => {
    const t = await getTrends(
      deps(
        {
          activity: [{ date: TODAY, kcal: 200, minutes: 45 }, { date: addDays(TODAY, -3), kcal: 100, minutes: 25 }],
          steps: [{ date: TODAY, steps: 8000 }, { date: addDays(TODAY, -1), steps: 6000 }],
          water: [{ date: TODAY, ml: 2000 }, { date: TODAY, ml: 500 }, { date: addDays(TODAY, -1), ml: 1000 }],
        },
        {
          wellbeing: { get: async () => null, upsert: async () => {}, list: async () => [{ date: TODAY, sleepHours: 7, mood: 4 }, { date: addDays(TODAY, -1), sleepHours: 6, mood: null }] },
          habits: {
            list: async () => [{ id: "h1", name: "A", sortOrder: 0 }, { id: "h2", name: "B", sortOrder: 1 }],
            checks: async () => [{ habitId: "h1", date: TODAY }, { habitId: "h2", date: TODAY }, { habitId: "viejo", date: TODAY }],
            create: async () => "",
            rename: async () => false,
            archive: async () => false,
            setCheck: async () => {},
          },
        },
      ),
      U,
      7,
      FALLBACK,
    );
    expect(t.summary.activity).toEqual({ activeDays: 2, weeklyMinutes: 70, avgExerciseKcal: 43, avgSteps: 7000 });
    expect(t.summary.water).toEqual({ loggedDays: 2, avgMl: 1750, goalDays: 1 });
    expect(t.summary.wellbeing).toEqual({ avgSleep: 6.5, sleepDays: 2, avgMood: 4 });
    expect(t.summary.habits).toEqual({ count: 2, done: 2, possible: 14 });
  });

  it("tendencia de peso y ritmo semanal", async () => {
    const weights = Array.from({ length: 36 }, (_, i) => ({ date: addDays(TODAY, -35 + i), weightKg: 75 - i * 0.05 }));
    const t = await getTrends(deps({}, { weightHistory: { list: async () => weights, remove: async () => false, count: async () => 36 } }), U, 30, FALLBACK);
    expect(t.summary.weight.change).toBe(-1.4); // 29 días × 0,05
    expect(t.summary.weight.weeklyRate).toBeCloseTo(-0.34, 2);
  });

  it("90 días se agrupan por semana", async () => {
    const t = await getTrends(deps({ activity: [{ date: TODAY, kcal: 100, minutes: 30 }, { date: addDays(TODAY, -2), kcal: 100, minutes: 20 }] }), U, 90, FALLBACK);
    expect(t.grouping).toBe("week");
    expect(t.series).toHaveLength(13);
    expect(t.series[0]!.date).toBe(addDays(TODAY, -89));
    expect(t.series.at(-1)).toMatchObject({ date: addDays(TODAY, -6), minutes: 50 });
  });

  it("rango solo 7, 30 o 90", () => {
    expect(pickRange("30")).toBe(30);
    expect(pickRange("365")).toBe(7);
    expect(pickRange(undefined)).toBe(7);
  });
});
