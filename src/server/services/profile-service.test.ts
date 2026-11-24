import { describe, expect, it } from "vitest";
import type { DailyTargets } from "@/lib/calc";
import type { ProfileRecord, WeightRecord } from "@/server/repositories/types";
import { getProfileOverview, recomputeTargets, saveProfile, type ProfileDeps } from "./profile-service";

const USER = "u1";

/** Repositorios en memoria: el servicio no sabe que no es Supabase. */
function fakeDeps(now = "2026-11-24T15:00:00Z") {
  const state = {
    profile: {
      id: USER,
      sex: null,
      birthDate: null,
      heightCm: null,
      activityLevel: null,
      timezone: "America/Argentina/Buenos_Aires",
      goal: null,
      weeklyRateKg: null,
      waterGoalOverrideMl: null,
      onboardingCompletedAt: null,
    } as ProfileRecord,
    weights: [] as WeightRecord[],
    targets: new Map<string, DailyTargets>(),
  };
  const deps: ProfileDeps = {
    now: () => new Date(now),
    profiles: {
      get: async () => state.profile,
      update: async (_id, patch) => {
        state.profile = { ...state.profile, ...patch };
      },
    },
    weights: {
      latestOnOrBefore: async (_id, date) =>
        state.weights.filter((w) => w.date <= date).sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null,
      upsert: async (_id, date, weightKg) => {
        state.weights = state.weights.filter((w) => w.date !== date).concat({ date, weightKg });
      },
    },
    targets: {
      get: async (_id, date) => state.targets.get(date) ?? null,
      upsert: async (_id, date, t) => {
        state.targets.set(date, t);
      },
    },
  };
  return { deps, state };
}

const validForm = {
  sex: "female",
  birthDate: "1990-05-01",
  heightCm: "165",
  weightKg: "70,0",
  activityLevel: "light",
  timezone: "America/Argentina/Buenos_Aires",
  goal: "lose",
  weeklyRateKg: "0.5",
  healthAck: "on",
};

describe("saveProfile (onboarding)", () => {
  it("guarda el perfil, el peso de hoy y las metas del día", async () => {
    const { deps, state } = fakeDeps();
    const result = await saveProfile(deps, USER, validForm, "onboarding");
    expect(result).toEqual({ ok: true });
    expect(state.profile.onboardingCompletedAt).not.toBeNull();
    expect(state.profile.weeklyRateKg).toBe(0.5);
    expect(state.weights).toEqual([{ date: "2026-11-24", weightKg: 70 }]);
    expect(state.targets.get("2026-11-24")?.kcalTarget).toBe(1362);
  });

  it("usa el día local del usuario (no UTC)", async () => {
    // 01:00 UTC del 25/11 = 22:00 del 24/11 en Buenos Aires.
    const { deps, state } = fakeDeps("2026-11-25T01:00:00Z");
    await saveProfile(deps, USER, validForm, "onboarding");
    expect(state.weights[0]?.date).toBe("2026-11-24");
  });

  it("exige aceptar el aviso de salud", async () => {
    const { deps, state } = fakeDeps();
    const withoutAck = { ...validForm, healthAck: undefined };
    const result = await saveProfile(deps, USER, withoutAck, "onboarding");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.healthAck).toBeTruthy();
    expect(state.profile.onboardingCompletedAt).toBeNull();
  });

  it("rechaza menores de 18", async () => {
    const { deps } = fakeDeps();
    const result = await saveProfile(deps, USER, { ...validForm, birthDate: "2010-01-01" }, "onboarding");
    expect(!result.ok && result.fieldErrors.birthDate?.[0]).toMatch(/18 años/);
  });

  it("rechaza en el servidor un ritmo inseguro, aunque el cliente lo deje pasar", async () => {
    const { deps, state } = fakeDeps();
    const result = await saveProfile(
      deps,
      USER,
      { ...validForm, activityLevel: "sedentary", weeklyRateKg: "1" },
      "onboarding",
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors.weeklyRateKg?.[0]).toMatch(/0,25 kg por semana/);
    expect(state.weights).toHaveLength(0);
  });

  it("rechaza valores fuera de rango", async () => {
    const { deps } = fakeDeps();
    const result = await saveProfile(deps, USER, { ...validForm, heightCm: "17", weightKg: "abc" }, "onboarding");
    expect(!result.ok && Object.keys(result.fieldErrors)).toEqual(expect.arrayContaining(["heightCm", "weightKg"]));
  });

  it("mantener guarda ritmo 0 aunque llegue otro valor", async () => {
    const { deps, state } = fakeDeps();
    await saveProfile(deps, USER, { ...validForm, goal: "maintain", weeklyRateKg: "0.75" }, "onboarding");
    expect(state.profile.weeklyRateKg).toBe(0);
  });
});

describe("saveProfile (edición)", () => {
  it("no exige el aviso y guarda la meta de agua manual", async () => {
    const { deps, state } = fakeDeps();
    await saveProfile(deps, USER, validForm, "onboarding");
    const form = { ...validForm, healthAck: undefined };
    const result = await saveProfile(deps, USER, { ...form, weightKg: "68", waterGoalOverrideMl: "3000" }, "edit");
    expect(result).toEqual({ ok: true });
    expect(state.profile.waterGoalOverrideMl).toBe(3000);
    // Cambiar el peso recalcula las metas del día.
    expect(state.targets.get("2026-11-24")?.bmrKcal).toBe(1370);
    expect(state.targets.get("2026-11-24")?.waterMl).toBe(3000);
  });
});

describe("recomputeTargets y getProfileOverview", () => {
  it("devuelven null si el onboarding no está completo", async () => {
    const { deps } = fakeDeps();
    expect(await recomputeTargets(deps, USER, "2026-11-24")).toBeNull();
    expect(await getProfileOverview(deps, USER)).toBeNull();
  });

  it("recalcula con la actividad del día", async () => {
    const { deps, state } = fakeDeps();
    await saveProfile(deps, USER, validForm, "onboarding");
    const t = await recomputeTargets(deps, USER, "2026-11-24", { exerciseKcal: 300, hadExercise: true });
    expect(t?.kcalTarget).toBe(1662);
    expect(state.targets.get("2026-11-24")?.waterMl).toBe(2950);
  });

  it("el resumen usa el último peso registrado", async () => {
    const { deps } = fakeDeps();
    await saveProfile(deps, USER, validForm, "onboarding");
    const overview = await getProfileOverview(deps, USER);
    expect(overview?.weightKg).toBe(70);
    expect(overview?.targets?.kcalTarget).toBe(1362);
  });
});

describe("actividad registrada del día", () => {
  it("suma ejercicio y pasos extra, sin contar dos veces los de una caminata", async () => {
    const { deps } = fakeDeps();
    await saveProfile(deps, USER, validForm, "onboarding");
    deps.activityLog = async () => ({ entries: [{ kcal: 300, stepsIncluded: 3000 }], steps: 9000 });
    // 9000 − 3000 de la caminata − 6000 de base (nivel liviano) = 0 pasos extra.
    expect((await recomputeTargets(deps, USER, "2026-11-24"))?.kcalTarget).toBe(1662);
    deps.activityLog = async () => ({ entries: [], steps: 12000 });
    const t = await recomputeTargets(deps, USER, "2026-11-24");
    expect(t!.kcalTarget).toBeGreaterThan(1362);
    expect(t!.waterMl).toBe(2450); // pasos solos no cuentan como día de ejercicio
    expect((await getProfileOverview(deps, USER))?.targets?.kcalTarget).toBe(t!.kcalTarget);
  });
});

describe("saveProfile con formulario vacío", () => {
  it("devuelve errores por campo (no explota)", async () => {
    const { deps, state } = fakeDeps();
    const result = await saveProfile(deps, USER, {}, "onboarding");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.birthDate?.[0]).toBe("Ingresá tu fecha de nacimiento");
      expect(result.fieldErrors.sex).toBeTruthy();
      expect(result.fieldErrors.healthAck).toBeTruthy();
    }
    expect(state.weights).toHaveLength(0);
  });
});
