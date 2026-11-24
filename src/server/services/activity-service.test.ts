import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/lib/calc";
import type { ActivityEntry, Exercise, MetActivity, StrengthHistoryRow } from "@/server/repositories/activity-types";
import {
  addActivity,
  deleteActivity,
  getActivityDay,
  getStrengthHistory,
  getTrainedExercises,
  saveSteps,
  updateActivity,
  type ActivityDeps,
} from "./activity-service";

const USER = "u1";
const TODAY = "2026-11-24";

const ACTIVITIES: MetActivity[] = [
  { id: 1, slug: "pesas", name: "Pesas", category: "gym", metLow: 3.5, metModerate: 5, metHigh: 6, isAmbulatory: false },
  { id: 2, slug: "caminar", name: "Caminar", category: "cardio", metLow: 2.8, metModerate: 3.5, metHigh: 5, isAmbulatory: true },
  { id: 3, slug: "correr", name: "Correr", category: "cardio", metLow: 8.3, metModerate: 9.8, metHigh: 11.8, isAmbulatory: true },
];
const EXERCISES: Exercise[] = [
  { id: 10, slug: "sentadilla", name: "Sentadilla", muscleGroup: "piernas" },
  { id: 11, slug: "press_banca", name: "Press de banca", muscleGroup: "pecho" },
];

function fakeDeps(opts: { weightKg?: number | null } = {}) {
  const entries = new Map<string, ActivityEntry>();
  const steps = new Map<string, number>();
  const recomputed: IsoDate[] = [];
  let seq = 0;
  const weightKg = opts.weightKg === undefined ? 80 : opts.weightKg;
  const deps: ActivityDeps = {
    catalog: { activities: async () => ACTIVITIES, exercises: async () => EXERCISES },
    entries: {
      listByDate: async (_u, date) => [...entries.values()].filter((e) => e.date === date),
      get: async (_u, id) => entries.get(id) ?? null,
      insert: async (_u, e) => {
        const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entries.set(id, { ...e, id });
        return id;
      },
      update: async (_u, id, e) => {
        const cur = entries.get(id);
        if (!cur) return false;
        entries.set(id, { ...cur, ...e, date: cur.date, id });
        return true;
      },
      remove: async (_u, id) => entries.delete(id),
      strengthHistory: async (_u, exerciseId) => {
        const rows: StrengthHistoryRow[] = [];
        for (const e of entries.values())
          for (const s of e.sets)
            if (s.exerciseId === exerciseId) rows.unshift({ date: e.date, entryId: e.id, setNumber: s.setNumber, reps: s.reps, weightKg: s.weightKg });
        return rows;
      },
      trainedExerciseIds: async () => [...new Set([...entries.values()].flatMap((e) => e.sets.map((s) => s.exerciseId)))],
    },
    steps: {
      get: async (_u, date) => steps.get(date) ?? null,
      upsert: async (_u, date, n) => {
        steps.set(date, n);
      },
    },
    weights: {
      latestOnOrBefore: async () => (weightKg === null ? null : { date: "2026-11-01", weightKg }),
      upsert: async () => {},
    },
    today: async () => TODAY,
    recomputeDay: async (date) => {
      recomputed.push(date);
      return null;
    },
  };
  return { deps, entries, steps, recomputed };
}

const sets = (list: { exerciseId: number; reps: number; weightKg: number }[]) => JSON.stringify(list);

describe("addActivity", () => {
  it("calcula MET y calorías en el servidor y recalcula la meta del día", async () => {
    const { deps, entries, recomputed } = fakeDeps();
    const r = await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "moderate", durationMin: "60" });
    expect(r).toEqual({ ok: true, value: { date: TODAY } });
    const [e] = [...entries.values()];
    expect(e).toMatchObject({ metValue: 5, kcal: 320, stepsIncluded: 0, sets: [] }); // (5 − 1) × 80 × 1
    expect(recomputed).toEqual([TODAY]);
  });

  it("ignora calorías o MET que mande el cliente", async () => {
    const { deps, entries } = fakeDeps();
    await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "low", durationMin: "30", kcal: "9999", metValue: "25" });
    expect([...entries.values()][0]).toMatchObject({ metValue: 3.5, kcal: 100 });
  });

  it("estima los pasos de caminatas y carreras para no contarlos dos veces", async () => {
    const { deps, entries } = fakeDeps();
    await addActivity(deps, USER, { date: TODAY, metActivityId: "2", intensity: "moderate", durationMin: "40" });
    await addActivity(deps, USER, { date: TODAY, metActivityId: "3", intensity: "low", durationMin: "30" });
    expect([...entries.values()].map((e) => e.stepsIncluded)).toEqual([4200, 4800]);
  });

  it("guarda series de fuerza numeradas", async () => {
    const { deps, entries } = fakeDeps();
    const r = await addActivity(deps, USER, {
      date: TODAY,
      metActivityId: "1",
      intensity: "high",
      durationMin: "45",
      sets: sets([
        { exerciseId: 10, reps: 8, weightKg: 60 },
        { exerciseId: 10, reps: 6, weightKg: 70 },
      ]),
    });
    expect(r.ok).toBe(true);
    expect([...entries.values()][0]!.sets).toEqual([
      { exerciseId: 10, setNumber: 1, reps: 8, weightKg: 60 },
      { exerciseId: 10, setNumber: 2, reps: 6, weightKg: 70 },
    ]);
  });

  it("rechaza series en actividades que no son de fuerza o con ejercicios inventados", async () => {
    const { deps, entries } = fakeDeps();
    const a = await addActivity(deps, USER, { date: TODAY, metActivityId: "2", intensity: "low", durationMin: "20", sets: sets([{ exerciseId: 10, reps: 5, weightKg: 0 }]) });
    const b = await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "low", durationMin: "20", sets: sets([{ exerciseId: 999, reps: 5, weightKg: 0 }]) });
    expect(a).toMatchObject({ ok: false, code: "invalid_input" });
    expect(b).toMatchObject({ ok: false, code: "invalid_input" });
    expect(entries.size).toBe(0);
  });

  it("valida rangos, actividad y fecha", async () => {
    const { deps } = fakeDeps();
    expect(await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "moderate", durationMin: "0" })).toMatchObject({ code: "invalid_input" });
    expect(await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "extrema", durationMin: "10" })).toMatchObject({ code: "invalid_input" });
    expect(await addActivity(deps, USER, { date: TODAY, metActivityId: "77", intensity: "low", durationMin: "10" })).toMatchObject({ code: "invalid_input" });
    expect(await addActivity(deps, USER, { date: "2026-11-25", metActivityId: "1", intensity: "low", durationMin: "10" })).toMatchObject({ code: "date_out_of_range" });
    expect(await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "low", durationMin: "10", sets: "{no es json" })).toMatchObject({ code: "invalid_input" });
  });

  it("pide un peso cargado para calcular", async () => {
    const { deps } = fakeDeps({ weightKg: null });
    expect(await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "low", durationMin: "10" })).toMatchObject({ code: "no_weight" });
  });
});

describe("editar y borrar", () => {
  it("recalcula al editar y mantiene la fecha original", async () => {
    const { deps, entries, recomputed } = fakeDeps();
    await addActivity(deps, USER, { date: "2026-11-20", metActivityId: "1", intensity: "low", durationMin: "30" });
    const id = [...entries.keys()][0]!;
    const r = await updateActivity(deps, USER, { entryId: id, metActivityId: "3", intensity: "moderate", durationMin: "30", date: TODAY });
    expect(r).toEqual({ ok: true, value: { date: "2026-11-20" } });
    expect(entries.get(id)).toMatchObject({ date: "2026-11-20", metValue: 9.8, kcal: 352, stepsIncluded: 4800 });
    expect(recomputed).toEqual(["2026-11-20", "2026-11-20"]);
  });

  it("no encuentra entradas ajenas o inexistentes", async () => {
    const { deps } = fakeDeps();
    const id = "00000000-0000-4000-8000-000000000999";
    expect(await updateActivity(deps, USER, { entryId: id, metActivityId: "1", intensity: "low", durationMin: "10" })).toMatchObject({ code: "not_found" });
    expect(await deleteActivity(deps, USER, id)).toMatchObject({ code: "not_found" });
    expect(await deleteActivity(deps, USER, "no-es-uuid")).toMatchObject({ code: "invalid_input" });
  });

  it("borra y recalcula", async () => {
    const { deps, entries, recomputed } = fakeDeps();
    await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "low", durationMin: "30" });
    const id = [...entries.keys()][0]!;
    expect(await deleteActivity(deps, USER, id)).toEqual({ ok: true, value: { date: TODAY } });
    expect(entries.size).toBe(0);
    expect(recomputed).toHaveLength(2);
  });
});

describe("pasos", () => {
  it("guarda los pasos del día y recalcula", async () => {
    const { deps, steps, recomputed } = fakeDeps();
    expect(await saveSteps(deps, USER, { date: TODAY, steps: "9500" })).toEqual({ ok: true, value: { date: TODAY } });
    expect(steps.get(TODAY)).toBe(9500);
    expect(recomputed).toEqual([TODAY]);
  });

  it("valida el rango", async () => {
    const { deps } = fakeDeps();
    expect(await saveSteps(deps, USER, { date: TODAY, steps: "-1" })).toMatchObject({ code: "invalid_input" });
    expect(await saveSteps(deps, USER, { date: TODAY, steps: "100001" })).toMatchObject({ code: "invalid_input" });
    expect(await saveSteps(deps, USER, { date: "2025-01-01", steps: "100" })).toMatchObject({ code: "date_out_of_range" });
  });
});

describe("lecturas", () => {
  it("arma el día con nombres y totales", async () => {
    const { deps } = fakeDeps();
    await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "moderate", durationMin: "60", sets: sets([{ exerciseId: 11, reps: 10, weightKg: 40 }]) });
    await addActivity(deps, USER, { date: TODAY, metActivityId: "2", intensity: "moderate", durationMin: "30" });
    await saveSteps(deps, USER, { date: TODAY, steps: "8000" });
    const day = await getActivityDay(deps, USER, TODAY);
    expect(day.minutes).toBe(90);
    expect(day.exerciseKcal).toBe(320 + 100);
    expect(day.steps).toBe(8000);
    expect(day.entries[0]!.activity?.name).toBe("Pesas");
    expect(day.entries[0]!.setsWithNames[0]!.exerciseName).toBe("Press de banca");
  });

  it("agrupa el historial de fuerza por sesión con mejor serie, 1RM y volumen", async () => {
    const { deps } = fakeDeps();
    await addActivity(deps, USER, { date: "2026-11-20", metActivityId: "1", intensity: "moderate", durationMin: "45", sets: sets([{ exerciseId: 10, reps: 10, weightKg: 50 }, { exerciseId: 10, reps: 5, weightKg: 60 }]) });
    await addActivity(deps, USER, { date: TODAY, metActivityId: "1", intensity: "moderate", durationMin: "45", sets: sets([{ exerciseId: 10, reps: 8, weightKg: 62.5 }]) });
    const h = await getStrengthHistory(deps, USER, "10");
    expect(h?.exercise.name).toBe("Sentadilla");
    expect(h?.sessions.map((s) => s.date)).toEqual([TODAY, "2026-11-20"]);
    expect(h?.sessions[1]!.sets).toEqual([{ reps: 10, weightKg: 50 }, { reps: 5, weightKg: 60 }]);
    expect(h?.sessions[1]).toMatchObject({ bestSet: { reps: 5, weightKg: 60 }, estimatedOneRepMax: 70, volumeKg: 800 });
    expect(h?.sessions[0]).toMatchObject({ estimatedOneRepMax: 79.2, volumeKg: 500 });
    expect(await getStrengthHistory(deps, USER, "abc")).toBeNull();
    expect(await getStrengthHistory(deps, USER, "999")).toBeNull();
    expect((await getTrainedExercises(deps, USER)).map((e) => e.id)).toEqual([10]);
  });
});
