import { describe, expect, it } from "vitest";
import { habitWindow, type IsoDate } from "@/lib/calc";
import type { Habit, Wellbeing } from "@/server/repositories/tracking-types";
import type { WeightRecord } from "@/server/repositories/types";
import {
  MAX_HABITS,
  addWater,
  archiveHabit,
  createHabit,
  deleteWeight,
  getTrackingDay,
  getWeightHistory,
  logWeight,
  renameHabit,
  saveWellbeing,
  toggleHabit,
  undoWater,
  type TrackingDeps,
} from "./tracking-service";

const U = "u1";
const TODAY = "2026-11-24";

function fakeDeps() {
  const water: { date: IsoDate; ml: number }[] = [];
  let weights: WeightRecord[] = [{ date: "2026-11-01", weightKg: 70 }];
  const wellbeing = new Map<IsoDate, Wellbeing>();
  const habits: (Habit & { archived: boolean })[] = [];
  const checks = new Set<string>();
  const recomputed: IsoDate[] = [];
  let seq = 0;
  const deps: TrackingDeps = {
    water: {
      total: async (_u, d) => water.filter((w) => w.date === d).reduce((s, w) => s + w.ml, 0),
      add: async (_u, date, ml) => void water.push({ date, ml }),
      removeLast: async (_u, d) => {
        const i = water.map((w) => w.date).lastIndexOf(d);
        if (i < 0) return false;
        water.splice(i, 1);
        return true;
      },
    },
    weights: {
      latestOnOrBefore: async (_u, d) => weights.filter((w) => w.date <= d).sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null,
      upsert: async (_u, date, weightKg) => {
        weights = weights.filter((w) => w.date !== date).concat({ date, weightKg });
      },
    },
    weightHistory: {
      list: async (_u, from, to) => weights.filter((w) => w.date >= from && w.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1)),
      remove: async (_u, d) => {
        const n = weights.length;
        weights = weights.filter((w) => w.date !== d);
        return weights.length < n;
      },
      count: async () => weights.length,
    },
    wellbeing: {
      get: async (_u, d) => wellbeing.get(d) ?? null,
      list: async () => [...wellbeing.values()],
      upsert: async (_u, e) => void wellbeing.set(e.date, e),
    },
    habits: {
      list: async () => habits.filter((h) => !h.archived),
      create: async (_u, name, sortOrder) => {
        const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        habits.push({ id, name, sortOrder, archived: false });
        return id;
      },
      rename: async (_u, id, name) => {
        const h = habits.find((x) => x.id === id && !x.archived);
        if (h) h.name = name;
        return !!h;
      },
      archive: async (_u, id) => {
        const h = habits.find((x) => x.id === id && !x.archived);
        if (h) h.archived = true;
        return !!h;
      },
      checks: async (_u, from, to) =>
        [...checks].map((k) => k.split("|") as [string, string]).filter(([, d]) => d >= from && d <= to).map(([habitId, date]) => ({ habitId, date })),
      setCheck: async (_u, id, date, done) => void (done ? checks.add(`${id}|${date}`) : checks.delete(`${id}|${date}`)),
    },
    today: async () => TODAY,
    recomputeDay: async (d) => {
      recomputed.push(d);
      return null;
    },
  };
  return { deps, recomputed, get weights() { return weights; }, wellbeing };
}

describe("agua", () => {
  it("suma y deshace el último vaso", async () => {
    const { deps } = fakeDeps();
    await addWater(deps, U, { date: TODAY, amountMl: "250" });
    expect(await addWater(deps, U, { date: TODAY, amountMl: "500" })).toEqual({ ok: true, value: { totalMl: 750 } });
    expect(await undoWater(deps, U, { date: TODAY })).toEqual({ ok: true, value: { totalMl: 250 } });
  });
  it("valida cantidad y fecha", async () => {
    const { deps } = fakeDeps();
    expect(await addWater(deps, U, { date: TODAY, amountMl: "0" })).toMatchObject({ code: "invalid_input" });
    expect(await addWater(deps, U, { date: TODAY, amountMl: "5000" })).toMatchObject({ code: "invalid_input" });
    expect(await addWater(deps, U, { date: "2026-11-25", amountMl: "250" })).toMatchObject({ code: "date_out_of_range" });
    expect(await undoWater(deps, U, { date: TODAY })).toMatchObject({ code: "not_found" });
  });
});

describe("peso", () => {
  it("guarda y recalcula las metas del día y de hoy", async () => {
    const f = fakeDeps();
    expect(await logWeight(f.deps, U, { date: "2026-11-20", weightKg: "69,4" })).toEqual({ ok: true, value: { date: "2026-11-20" } });
    expect(f.weights.find((w) => w.date === "2026-11-20")?.weightKg).toBe(69.4);
    expect(f.recomputed).toEqual(["2026-11-20", TODAY]);
  });
  it("valida rangos", async () => {
    const { deps } = fakeDeps();
    expect(await logWeight(deps, U, { date: TODAY, weightKg: "20" })).toMatchObject({ code: "invalid_input" });
    expect(await logWeight(deps, U, { date: TODAY, weightKg: "" })).toMatchObject({ code: "invalid_input" });
    expect(await logWeight(deps, U, { date: "2027-01-01", weightKg: "70" })).toMatchObject({ code: "date_out_of_range" });
  });
  it("no deja borrar el único peso", async () => {
    const f = fakeDeps();
    expect(await deleteWeight(f.deps, U, { date: "2026-11-01" })).toMatchObject({ code: "last_weight" });
    await logWeight(f.deps, U, { date: TODAY, weightKg: "69" });
    expect(await deleteWeight(f.deps, U, { date: TODAY })).toEqual({ ok: true, value: { date: TODAY } });
  });
  it("calcula la tendencia (promedio de 7 días) y el cambio semanal", async () => {
    const f = fakeDeps();
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(2026, 10, 11 + i)).toISOString().slice(0, 10);
      await logWeight(f.deps, U, { date: d, weightKg: String(72 - i * 0.1) });
    }
    const h = await getWeightHistory(f.deps, U, 30);
    expect(h.latest?.date).toBe(TODAY);
    expect(h.latest?.trend).toBeCloseTo(71, 2);
    expect(h.weeklyChange).toBe(-0.7);
  });
});

describe("sueño y ánimo", () => {
  it("completar uno no borra el otro", async () => {
    const f = fakeDeps();
    await saveWellbeing(f.deps, U, { date: TODAY, sleepHours: "7,5" });
    await saveWellbeing(f.deps, U, { date: TODAY, mood: "4" });
    expect(f.wellbeing.get(TODAY)).toEqual({ date: TODAY, sleepHours: 7.5, mood: 4 });
  });
  it("pide al menos un dato y rangos válidos", async () => {
    const { deps } = fakeDeps();
    expect(await saveWellbeing(deps, U, { date: TODAY })).toMatchObject({ code: "invalid_input" });
    expect(await saveWellbeing(deps, U, { date: TODAY, sleepHours: "25" })).toMatchObject({ code: "invalid_input" });
    expect(await saveWellbeing(deps, U, { date: TODAY, mood: "6" })).toMatchObject({ code: "invalid_input" });
  });
});

describe("hábitos", () => {
  it("crea, marca y muestra cuántos de los últimos 7 días", async () => {
    const { deps } = fakeDeps();
    const r = await createHabit(deps, U, { name: "  Caminar 20 min " });
    expect(r.ok).toBe(true);
    const id = r.ok ? r.value.id : "";
    for (const d of ["2026-11-18", "2026-11-20", "2026-11-23", TODAY, "2026-11-10"]) {
      await toggleHabit(deps, U, { habitId: id, date: d, done: "true" });
    }
    const day = await getTrackingDay(deps, U, TODAY);
    expect(day.habits[0]).toMatchObject({ name: "Caminar 20 min", done: 4, window: 7, doneToday: true });
    await toggleHabit(deps, U, { habitId: id, date: TODAY, done: "false" });
    expect((await getTrackingDay(deps, U, TODAY)).habits[0]?.done).toBe(3);
  });
  it("renombra, archiva y valida", async () => {
    const { deps } = fakeDeps();
    const r = await createHabit(deps, U, { name: "Leer" });
    const id = r.ok ? r.value.id : "";
    expect(await createHabit(deps, U, { name: "   " })).toMatchObject({ code: "invalid_input" });
    expect(await createHabit(deps, U, { name: "x".repeat(61) })).toMatchObject({ code: "invalid_input" });
    expect(await renameHabit(deps, U, { habitId: id, name: "Leer 10 páginas" })).toEqual({ ok: true, value: null });
    expect(await archiveHabit(deps, U, { habitId: id })).toEqual({ ok: true, value: null });
    expect(await toggleHabit(deps, U, { habitId: id, date: TODAY, done: "true" })).toMatchObject({ code: "not_found" });
    expect(await toggleHabit(deps, U, { habitId: "nope", date: TODAY, done: "true" })).toMatchObject({ code: "invalid_input" });
  });
  it("tiene un máximo de hábitos activos", async () => {
    const { deps } = fakeDeps();
    for (let i = 0; i < MAX_HABITS; i++) await createHabit(deps, U, { name: `H${i}` });
    expect(await createHabit(deps, U, { name: "uno más" })).toMatchObject({ code: "too_many_habits" });
  });
});

describe("habitWindow", () => {
  it("cuenta días de la ventana, sin castigar días sueltos", () => {
    const w = habitWindow(["2026-11-24", "2026-11-22", "2026-11-01"], "2026-11-24");
    expect(w.done).toBe(2);
    expect(w.days.map((d) => d.done)).toEqual([false, false, false, false, true, false, true]);
  });
});
