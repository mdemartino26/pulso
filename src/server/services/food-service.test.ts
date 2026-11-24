import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodRef, ProviderFood } from "@/lib/food";
import { ProviderError, type FoodProvider } from "@/server/food/providers/types";
import type { CachedFood, CustomFood, FoodEntry } from "@/server/repositories/food-types";
import {
  addEntry,
  copyDay,
  createCustomFood,
  getDayLog,
  getRecentFoods,
  lookupBarcode,
  searchFoods,
  setFavorite,
  updateEntry,
  type FoodDeps,
} from "./food-service";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

const per100 = { kcal: 450, protein: 5, carbs: 62, fat: 20, fiber: null, sugars: 35, sodiumMg: 200 };
const alfajor: ProviderFood = {
  source: "off",
  sourceId: "7790580660000",
  barcode: "7790580660000",
  name: "Alfajor triple",
  brand: "Marca X",
  basis: "g",
  per100,
  serving: { size: 55, label: "1 alfajor" },
  imageUrl: null,
};

function fakeDeps(opts: { allow?: boolean; providers?: FoodProvider[] } = {}) {
  const cache: CachedFood[] = [];
  const searches = new Map<string, { foodIds: string[]; fetchedAt: string }>();
  const customs: (CustomFood & { userId: string })[] = [];
  const entries: (FoodEntry & { userId: string })[] = [];
  const favorites: { userId: string; ref: FoodRef }[] = [];
  const now = new Date("2026-11-24T15:00:00Z");

  const deps: FoodDeps = {
    now: () => now,
    today: async () => "2026-11-24",
    providers: opts.providers ?? [],
    rateLimiter: { consume: async () => opts.allow ?? true },
    catalog: {
      getMany: async (ids) => ids.flatMap((id) => cache.filter((f) => f.id === id)),
      findByBarcode: async (code) => cache.find((f) => f.barcode === code) ?? null,
      searchByName: async (q) => cache.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())),
    },
    cacheWriter: () => ({
      upsertFoods: async (foods) =>
        foods.map((f) => {
          const existing = cache.find((c) => c.source === f.source && c.sourceId === f.sourceId);
          if (existing) return Object.assign(existing, f, { fetchedAt: now.toISOString() });
          const row = { ...f, id: uuid(), fetchedAt: now.toISOString() };
          cache.push(row);
          return row;
        }),
      getSearch: async (p, q) => searches.get(`${p}:${q}`) ?? null,
      saveSearch: async (p, q, ids) => void searches.set(`${p}:${q}`, { foodIds: ids, fetchedAt: now.toISOString() }),
    }),
    customFoods: {
      list: async (u) => customs.filter((c) => c.userId === u),
      getMany: async (u, ids) => customs.filter((c) => c.userId === u && ids.includes(c.id)),
      search: async (u, q) => customs.filter((c) => c.userId === u && c.name.toLowerCase().includes(q.toLowerCase())),
      create: async (u, d) => {
        const row = { ...d, id: uuid(), userId: u };
        customs.push(row);
        return row;
      },
      update: async () => true,
      remove: async () => true,
    },
    entries: {
      listByDate: async (u, d) => entries.filter((e) => e.userId === u && e.date === d),
      get: async (u, id) => entries.find((e) => e.userId === u && e.id === id) ?? null,
      insert: async (u, list) => {
        for (const e of list) {
          const amount = e.quantity * e.basePerUnit;
          const r1 = (x: number) => Math.round(x * 10) / 10;
          entries.push({
            ...e,
            id: uuid(),
            userId: u,
            amount,
            kcal: r1((amount * e.per100.kcal) / 100),
            protein: r1((amount * e.per100.protein) / 100),
            carbs: r1((amount * e.per100.carbs) / 100),
            fat: r1((amount * e.per100.fat) / 100),
            createdAt: new Date(now.getTime() + entries.length).toISOString(),
          });
        }
      },
      update: async (u, id, p) => {
        const e = entries.find((x) => x.userId === u && x.id === id);
        if (!e) return false;
        Object.assign(e, p, { amount: p.quantity * p.basePerUnit });
        return true;
      },
      remove: async () => true,
      recent: async (u) => entries.filter((e) => e.userId === u).reverse(),
    },
    favorites: {
      list: async (u) => favorites.filter((f) => f.userId === u).map((f) => f.ref),
      add: async (u, ref) => void favorites.push({ userId: u, ref }),
      remove: async () => undefined,
    },
  };
  return { deps, cache, entries, customs, searches };
}

const provider = (impl: Partial<FoodProvider> & { source?: FoodProvider["source"] } = {}): FoodProvider => ({
  source: "off",
  search: vi.fn(async () => [alfajor]),
  byBarcode: vi.fn(async () => alfajor),
  ...impl,
});

beforeEach(() => {
  seq = 0;
});

describe("búsqueda", () => {
  it("valida, guarda en caché y la reutiliza", async () => {
    const off = provider();
    const { deps, cache } = fakeDeps({ providers: [off] });
    const r1 = await searchFoods(deps, ME, "alfajor");
    expect(r1.ok && r1.value.foods.map((f) => f.name)).toEqual(["Alfajor triple"]);
    expect(cache).toHaveLength(1);
    await searchFoods(deps, ME, "  ALFAJOR ");
    expect(off.search).toHaveBeenCalledTimes(1); // segunda vez sale de la caché
  });

  it("rechaza búsquedas inválidas y respeta el límite por usuario", async () => {
    const { deps } = fakeDeps({ providers: [provider()], allow: false });
    expect(await searchFoods(deps, ME, "a")).toMatchObject({ ok: false, code: "invalid_input" });
    expect(await searchFoods(deps, ME, "alfajor")).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("si el proveedor falla, responde con la caché y avisa", async () => {
    const { deps, cache } = fakeDeps({
      providers: [provider({ search: async () => Promise.reject(new ProviderError("off", "timeout")) })],
    });
    cache.push({ ...alfajor, id: uuid(), fetchedAt: "2026-01-01T00:00:00Z" });
    const r = await searchFoods(deps, ME, "alfajor");
    expect(r).toMatchObject({ ok: true, value: { partial: true } });
    expect(r.ok && r.value.foods).toHaveLength(1);
  });

  it("si un proveedor o la caché fallan por otra causa, sigue con el resto", async () => {
    const usda = provider({ source: "usda", search: async () => Promise.reject(new Error("boom")) });
    const { deps } = fakeDeps({ providers: [provider(), usda] });
    const r = await searchFoods(deps, ME, "alfajor");
    expect(r).toMatchObject({ ok: true, value: { partial: true } });
    expect(r.ok && r.value.foods).toHaveLength(1);
  });

  it("sin claves configuradas o sin ninguna base disponible → 'unavailable', no un error 500", async () => {
    const { deps } = fakeDeps();
    Object.defineProperty(deps, "providers", {
      get() {
        throw new Error("Variables de entorno del servidor inválidas o faltantes: SUPABASE_SECRET_KEY");
      },
    });
    expect(await searchFoods(deps, ME, "huevo")).toMatchObject({ ok: false, code: "unavailable" });
    expect(await lookupBarcode(deps, ME, "7790000000001")).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("muestra primero mis alimentos y nunca los de otra persona", async () => {
    const { deps } = fakeDeps({ providers: [provider()] });
    await createCustomFood(deps, ME, { name: "Alfajor casero", basis: "g", kcal100: "400", protein100: "5", carbs100: "60", fat100: "15" });
    await createCustomFood(deps, OTHER, { name: "Alfajor ajeno", basis: "g", kcal100: "400", protein100: "5", carbs100: "60", fat100: "15" });
    const r = await searchFoods(deps, ME, "alfajor");
    expect(r.ok && r.value.foods.map((f) => f.name)).toEqual(["Alfajor casero", "Alfajor triple"]);
  });
});

describe("código de barras", () => {
  it("busca en el proveedor y guarda en la caché", async () => {
    const off = provider();
    const { deps, cache } = fakeDeps({ providers: [off] });
    const r = await lookupBarcode(deps, ME, "7790580660000");
    expect(r.ok && r.value.name).toBe("Alfajor triple");
    expect(cache).toHaveLength(1);
    await lookupBarcode(deps, ME, "7790580660000");
    expect(off.byBarcode).toHaveBeenCalledTimes(1);
  });
  it("código inválido, no encontrado y proveedor caído", async () => {
    expect(await lookupBarcode(fakeDeps().deps, ME, "abc")).toMatchObject({ code: "invalid_input" });
    const none = fakeDeps({ providers: [provider({ byBarcode: async () => null })] });
    expect(await lookupBarcode(none.deps, ME, "7790000000001")).toMatchObject({ code: "not_found" });
    const down = fakeDeps({ providers: [provider({ byBarcode: async () => Promise.reject(new ProviderError("off", "http", 503)) })] });
    expect(await lookupBarcode(down.deps, ME, "7790000000001")).toMatchObject({ code: "unavailable" });
  });
});

describe("registro de comidas", () => {
  async function withFood() {
    const ctx = fakeDeps({ providers: [provider()] });
    const r = await searchFoods(ctx.deps, ME, "alfajor");
    if (!r.ok) throw new Error("setup");
    return { ...ctx, food: r.value.foods[0]! };
  }

  it("guarda una foto de los nutrientes de la base, no los del formulario", async () => {
    const { deps, entries, food } = await withFood();
    const r = await addEntry(deps, ME, {
      source: food.ref.source,
      foodId: food.ref.id,
      date: "2026-11-24",
      meal: "afternoon_snack",
      quantity: "1",
      unit: "serving",
      kcal_100: "0", // intento de manipular: se ignora
    });
    expect(r.ok).toBe(true);
    expect(entries[0]).toMatchObject({ basePerUnit: 55, per100: { kcal: 450 }, kcal: 247.5 });
  });

  it("rechaza fechas futuras, porciones gigantes y unidades que no aplican", async () => {
    const { deps, food } = await withFood();
    const base = { source: food.ref.source, foodId: food.ref.id, date: "2026-11-24", meal: "lunch", quantity: "100", unit: "g" };
    expect(await addEntry(deps, ME, { ...base, date: "2026-11-25" })).toMatchObject({ code: "date_out_of_range" });
    expect(await addEntry(deps, ME, { ...base, date: "2025-01-01" })).toMatchObject({ code: "date_out_of_range" });
    expect(await addEntry(deps, ME, { ...base, quantity: "6000" })).toMatchObject({ code: "invalid_input" });
    expect(await addEntry(deps, ME, { ...base, unit: "ml" })).toMatchObject({ code: "unit_not_available" });
  });

  it("no deja usar el alimento propio de otra persona", async () => {
    const { deps } = fakeDeps();
    const other = await createCustomFood(deps, OTHER, { name: "Secreto", basis: "g", kcal100: "100", protein100: "1", carbs100: "1", fat100: "1" });
    if (!other.ok) throw new Error("setup");
    const r = await addEntry(deps, ME, { source: "custom", foodId: other.value.ref.id, date: "2026-11-24", meal: "lunch", quantity: "100", unit: "g" });
    expect(r).toMatchObject({ ok: false, code: "not_found" });
  });

  it("edita cantidad, unidad y comida", async () => {
    const { deps, entries, food } = await withFood();
    await addEntry(deps, ME, { source: "off", foodId: food.ref.id, date: "2026-11-24", meal: "lunch", quantity: "2", unit: "serving" });
    const id = entries[0]!.id;
    expect(await updateEntry(deps, ME, { entryId: id, meal: "dinner", quantity: "80", unit: "g" })).toMatchObject({ ok: true });
    expect(entries[0]).toMatchObject({ meal: "dinner", quantity: 80, unit: "g", basePerUnit: 1 });
    expect(await updateEntry(deps, OTHER, { entryId: id, meal: "dinner", quantity: "80", unit: "g" })).toMatchObject({ code: "not_found" });
  });

  it("copia el día anterior y arma el resumen por comida", async () => {
    const { deps, entries, food } = await withFood();
    await addEntry(deps, ME, { source: "off", foodId: food.ref.id, date: "2026-11-23", meal: "lunch", quantity: "100", unit: "g" });
    const log = await getDayLog(deps, ME, "2026-11-24");
    expect(log.previousDayHasEntries).toBe(true);
    expect(await copyDay(deps, ME, { from: "2026-11-23", to: "2026-11-24" })).toEqual({ ok: true, value: { copied: 1 } });
    expect(entries.filter((e) => e.date === "2026-11-24")).toHaveLength(1);
    const after = await getDayLog(deps, ME, "2026-11-24");
    expect(after.totals.kcal).toBe(450);
    expect(after.meals.find((m) => m.meal === "lunch")?.entries).toHaveLength(1);
    expect(await copyDay(deps, ME, { from: "2026-11-24", to: "2026-11-25" })).toMatchObject({ code: "date_out_of_range" });
  });

  it("recientes sin repetidos y favoritos marcados", async () => {
    const { deps, food } = await withFood();
    for (const q of ["100", "50"]) {
      await addEntry(deps, ME, { source: "off", foodId: food.ref.id, date: "2026-11-24", meal: "lunch", quantity: q, unit: "g" });
    }
    await setFavorite(deps, ME, food.ref, true);
    const recent = await getRecentFoods(deps, ME);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.favorite).toBe(true);
  });
});
