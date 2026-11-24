import { z } from "zod";
import { addDays, type IsoDate } from "@/lib/calc";
import {
  basePerUnit,
  normalizeQuery,
  sumNutrients,
  MEALS,
  type FoodRef,
  type FoodView,
  type Meal,
  type Nutrients,
} from "@/lib/food";
import {
  addEntrySchema,
  barcodeSchema,
  copyDaySchema,
  customFoodSchema,
  foodRefSchema,
  searchQuerySchema,
  updateEntrySchema,
  uuidSchema,
} from "@/lib/validation/food";
import { ProviderError, type FoodProvider } from "@/server/food/providers/types";
import type {
  CachedFood,
  CustomFood,
  CustomFoodData,
  CustomFoodRepository,
  FavoriteRepository,
  FoodCacheWriter,
  FoodCatalogRepository,
  FoodEntry,
  FoodEntryRepository,
  RateLimiter,
} from "@/server/repositories/food-types";

/**
 * Lógica de comidas. No conoce Supabase ni las APIs: recibe repositorios y
 * proveedores por parámetro (los arma food-deps.ts; en tests, fakes).
 */

export interface FoodDeps {
  catalog: FoodCatalogRepository;
  /** Se crea solo si hace falta escribir en la caché (usa la clave secreta). */
  cacheWriter: () => FoodCacheWriter;
  customFoods: CustomFoodRepository;
  entries: FoodEntryRepository;
  favorites: FavoriteRepository;
  rateLimiter: RateLimiter;
  providers: FoodProvider[];
  /** Fecha de hoy en la zona horaria del usuario. */
  today: () => Promise<IsoDate>;
  now: () => Date;
}

/** Límites por usuario (ventana de 60 s). Protegen las APIs gratuitas y nuestra cuota. */
export const RATE_LIMITS = {
  food_search: { max: 30, windowSeconds: 60 },
  food_barcode: { max: 20, windowSeconds: 60 },
} as const;

const SEARCH_TTL_MS = 7 * 24 * 3600 * 1000;
const FOOD_TTL_MS = 30 * 24 * 3600 * 1000;
/** Se pueden registrar comidas de hasta un año atrás. */
const MAX_DAYS_BACK = 366;

export type ServiceError =
  | "invalid_input"
  | "rate_limited"
  | "not_found"
  | "unavailable"
  | "unit_not_available"
  | "date_out_of_range";

export type Result<T> = { ok: true; value: T } | { ok: false; code: ServiceError; fieldErrors?: Record<string, string[] | undefined> };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: ServiceError, fieldErrors?: Record<string, string[] | undefined>): Result<never> =>
  fieldErrors ? { ok: false, code, fieldErrors } : { ok: false, code };

/**
 * Un proveedor (o la caché) que falla no tumba la búsqueda: se registra y
 * se sigue con lo demás. Se loguea solo el tipo de error y su código.
 */
function logSourceError(where: string, e: unknown) {
  if (e instanceof ProviderError) {
    console.warn(`[food] ${e.provider} falló`, { code: e.code, status: e.status });
  } else {
    // Errores de configuración (p. ej., falta SUPABASE_SECRET_KEY) o de la
    // base: el mensaje es nuestro y no contiene datos de la persona.
    console.error(`[food] ${where} falló:`, e instanceof Error ? `${e.name}: ${e.message}` : "desconocido");
  }
}

// --- Vistas ------------------------------------------------------------------

function cachedToView(f: CachedFood, favorites: Set<string>): FoodView {
  return {
    ref: { source: f.source, id: f.id },
    name: f.name,
    brand: f.brand,
    basis: f.basis,
    per100: f.per100,
    serving: f.serving,
    imageUrl: f.imageUrl,
    favorite: favorites.has(f.id),
  };
}

function customToView(f: CustomFood, favorites: Set<string>): FoodView {
  return {
    ref: { source: "custom", id: f.id },
    name: f.name,
    brand: f.brand,
    basis: f.basis,
    per100: f.per100,
    serving: f.serving,
    imageUrl: null,
    favorite: favorites.has(f.id),
  };
}

async function favoriteIds(deps: FoodDeps, userId: string): Promise<Set<string>> {
  return new Set((await deps.favorites.list(userId)).map((r) => r.id));
}

/** Busca alimentos por referencia, respetando el orden. Los que ya no existen se omiten. */
async function viewsFor(deps: FoodDeps, userId: string, refs: FoodRef[], favorites?: Set<string>): Promise<FoodView[]> {
  const favs = favorites ?? (await favoriteIds(deps, userId));
  const cacheIds = refs.filter((r) => r.source !== "custom").map((r) => r.id);
  const customIds = refs.filter((r) => r.source === "custom").map((r) => r.id);
  const [cached, custom] = await Promise.all([
    deps.catalog.getMany(cacheIds),
    deps.customFoods.getMany(userId, customIds),
  ]);
  const byId = new Map<string, FoodView>([
    ...cached.map((f) => [f.id, cachedToView(f, favs)] as const),
    ...custom.map((f) => [f.id, customToView(f, favs)] as const),
  ]);
  return refs.flatMap((r) => byId.get(r.id) ?? []);
}

export async function getFood(deps: FoodDeps, userId: string, ref: FoodRef): Promise<FoodView | null> {
  return (await viewsFor(deps, userId, [ref]))[0] ?? null;
}

// --- Búsqueda ----------------------------------------------------------------

const isFresh = (iso: string, ttl: number, now: Date) => now.getTime() - new Date(iso).getTime() < ttl;

async function searchProvider(deps: FoodDeps, provider: FoodProvider, query: string): Promise<CachedFood[]> {
  const qn = normalizeQuery(query);
  const writer = deps.cacheWriter();
  const cached = await writer.getSearch(provider.source, qn);
  if (cached && isFresh(cached.fetchedAt, SEARCH_TTL_MS, deps.now())) {
    return deps.catalog.getMany(cached.foodIds);
  }
  const found = await provider.search(query);
  const saved = await writer.upsertFoods(found.slice(0, 50));
  await writer.saveSearch(provider.source, qn, saved.map((f) => f.id));
  return saved;
}

export interface SearchResult {
  foods: FoodView[];
  /** Algún proveedor no respondió: puede haber menos resultados. */
  partial: boolean;
}

export async function searchFoods(deps: FoodDeps, userId: string, rawQuery: unknown): Promise<Result<SearchResult>> {
  const parsed = searchQuerySchema.safeParse(rawQuery);
  if (!parsed.success) return fail("invalid_input");
  const query = parsed.data;

  const { max, windowSeconds } = RATE_LIMITS.food_search;
  if (!(await deps.rateLimiter.consume("food_search", max, windowSeconds))) return fail("rate_limited");

  const favorites = await favoriteIds(deps, userId);
  let providers: FoodProvider[];
  try {
    providers = deps.providers;
  } catch (e) {
    logSourceError("configuración de proveedores", e);
    providers = [];
  }
  const [custom, ...perProvider] = await Promise.all([
    deps.customFoods.search(userId, query, 10),
    ...(providers.length > 0 ? providers : [null]).map((p) =>
      p
        ? searchProvider(deps, p, query).catch((e: unknown) => {
            logSourceError(p.source, e);
            return null;
          })
        : Promise.resolve(null),
    ),
  ]);

  const failed = perProvider.filter((r) => r === null).length;
  let external = perProvider.flatMap((r) => r ?? []);
  if (failed > 0 && external.length === 0) {
    // Sin proveedores: al menos lo que ya está en la caché.
    external = await deps.catalog.searchByName(query, 20);
  }
  if (failed > 0 && external.length === 0 && custom.length === 0) return fail("unavailable");

  const seen = new Set<string>();
  const foods = [
    ...custom.map((f) => customToView(f, favorites)),
    ...external.map((f) => cachedToView(f, favorites)),
  ].filter((f) => (seen.has(f.ref.id) ? false : (seen.add(f.ref.id), true)));

  return ok({ foods: foods.slice(0, 40), partial: failed > 0 });
}

export async function lookupBarcode(deps: FoodDeps, userId: string, rawCode: unknown): Promise<Result<FoodView>> {
  const parsed = barcodeSchema.safeParse(rawCode);
  if (!parsed.success) return fail("invalid_input");
  const barcode = parsed.data;

  const { max, windowSeconds } = RATE_LIMITS.food_barcode;
  if (!(await deps.rateLimiter.consume("food_barcode", max, windowSeconds))) return fail("rate_limited");

  const favorites = await favoriteIds(deps, userId);
  const cached = await deps.catalog.findByBarcode(barcode);
  if (cached && isFresh(cached.fetchedAt, FOOD_TTL_MS, deps.now())) return ok(cachedToView(cached, favorites));

  let anyFailed = false;
  let providers: FoodProvider[] = [];
  try {
    providers = deps.providers;
  } catch (e) {
    logSourceError("configuración de proveedores", e);
    anyFailed = true;
  }
  for (const provider of providers) {
    try {
      const found = await provider.byBarcode(barcode);
      if (found) {
        const [saved] = await deps.cacheWriter().upsertFoods([found]);
        if (saved) return ok(cachedToView(saved, favorites));
      }
    } catch (e) {
      logSourceError(provider.source, e);
      anyFailed = true;
    }
  }
  if (cached) return ok(cachedToView(cached, favorites)); // viejo pero mejor que nada
  return fail(anyFailed ? "unavailable" : "not_found");
}

// --- Registro del día ----------------------------------------------------------

async function checkDate(deps: FoodDeps, date: IsoDate): Promise<boolean> {
  const today = await deps.today();
  return date <= today && date >= addDays(today, -MAX_DAYS_BACK);
}

const flat = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;

export async function addEntry(deps: FoodDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = addEntrySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const input = parsed.data;
  if (!(await checkDate(deps, input.date))) return fail("date_out_of_range");

  // Los nutrientes salen SIEMPRE de la base, nunca del formulario.
  const food = await getFood(deps, userId, { source: input.source, id: input.foodId });
  if (!food) return fail("not_found");
  const bpu = basePerUnit(input.unit, food.basis, food.serving);
  if (bpu === null) return fail("unit_not_available");
  if (input.quantity * bpu > 5000) return fail("invalid_input", { quantity: ["Una porción no puede superar 5 kg o 5 L"] });

  await deps.entries.insert(userId, [
    {
      date: input.date,
      meal: input.meal,
      ref: food.ref,
      name: food.name,
      brand: food.brand,
      basis: food.basis,
      quantity: input.quantity,
      unit: input.unit,
      basePerUnit: bpu,
      per100: food.per100,
    },
  ]);
  return ok({ date: input.date });
}

export async function updateEntry(deps: FoodDeps, userId: string, raw: unknown): Promise<Result<{ date: IsoDate }>> {
  const parsed = updateEntrySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const input = parsed.data;
  const entry = await deps.entries.get(userId, input.entryId);
  if (!entry) return fail("not_found");

  let bpu: number | null;
  if (input.unit === entry.unit) bpu = entry.basePerUnit;
  else if (input.unit === entry.basis) bpu = 1;
  else if (input.unit === "serving" && entry.ref) {
    const food = await getFood(deps, userId, entry.ref);
    bpu = food ? basePerUnit("serving", food.basis, food.serving) : null;
  } else bpu = null;
  if (bpu === null) return fail("unit_not_available");
  if (input.quantity * bpu > 5000) return fail("invalid_input", { quantity: ["Una porción no puede superar 5 kg o 5 L"] });

  const updated = await deps.entries.update(userId, entry.id, {
    meal: input.meal,
    quantity: input.quantity,
    unit: input.unit,
    basePerUnit: bpu,
  });
  return updated ? ok({ date: entry.date }) : fail("not_found");
}

export async function deleteEntry(deps: FoodDeps, userId: string, rawId: unknown): Promise<Result<{ date: IsoDate }>> {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return fail("invalid_input");
  const entry = await deps.entries.get(userId, id.data);
  if (!entry) return fail("not_found");
  return (await deps.entries.remove(userId, entry.id)) ? ok({ date: entry.date }) : fail("not_found");
}

/** Copia las comidas de un día (o de una comida) a otro. Conserva los valores guardados. */
export async function copyDay(deps: FoodDeps, userId: string, raw: unknown): Promise<Result<{ copied: number }>> {
  const parsed = copyDaySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");
  const { from, to, meal } = parsed.data;
  if (from === to || !(await checkDate(deps, to))) return fail("date_out_of_range");
  const source = (await deps.entries.listByDate(userId, from)).filter((e) => meal === "all" || e.meal === meal);
  if (source.length === 0) return fail("not_found");
  await deps.entries.insert(
    userId,
    source.map((e) => ({
      date: to,
      meal: e.meal,
      ref: e.ref,
      name: e.name,
      brand: e.brand,
      basis: e.basis,
      quantity: e.quantity,
      unit: e.unit,
      basePerUnit: e.basePerUnit,
      per100: e.per100,
    })),
  );
  return ok({ copied: source.length });
}

export interface MealLog {
  meal: Meal;
  entries: FoodEntry[];
  totals: Nutrients;
}

export interface DayLog {
  date: IsoDate;
  meals: MealLog[];
  totals: Nutrients;
  /** Hay comidas cargadas el día anterior (para ofrecer "copiar de ayer"). */
  previousDayHasEntries: boolean;
}

export async function getDayLog(deps: FoodDeps, userId: string, date: IsoDate): Promise<DayLog> {
  const [entries, previous] = await Promise.all([
    deps.entries.listByDate(userId, date),
    deps.entries.listByDate(userId, addDays(date, -1)),
  ]);
  const meals = MEALS.map((meal) => {
    const list = entries.filter((e) => e.meal === meal);
    return { meal, entries: list, totals: sumNutrients(list) };
  });
  return { date, meals, totals: sumNutrients(entries), previousDayHasEntries: previous.length > 0 };
}

export async function getEntry(deps: FoodDeps, userId: string, rawId: unknown) {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return null;
  const entry = await deps.entries.get(userId, id.data);
  if (!entry) return null;
  const food = entry.ref ? await getFood(deps, userId, entry.ref) : null;
  return { entry, food };
}

// --- Recientes, favoritos y alimentos propios -----------------------------------

export async function getRecentFoods(deps: FoodDeps, userId: string, limit = 15): Promise<FoodView[]> {
  const recent = await deps.entries.recent(userId, 80);
  const seen = new Set<string>();
  const refs: FoodRef[] = [];
  for (const e of recent) {
    if (e.ref && !seen.has(e.ref.id)) {
      seen.add(e.ref.id);
      refs.push(e.ref);
      if (refs.length >= limit) break;
    }
  }
  return viewsFor(deps, userId, refs);
}

export async function getFavoriteFoods(deps: FoodDeps, userId: string): Promise<FoodView[]> {
  const refs = await deps.favorites.list(userId);
  return viewsFor(deps, userId, refs, new Set(refs.map((r) => r.id)));
}

export async function setFavorite(deps: FoodDeps, userId: string, raw: unknown, on: boolean): Promise<Result<true>> {
  const parsed = foodRefSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");
  const food = await getFood(deps, userId, parsed.data);
  if (!food) return fail("not_found");
  if (on) await deps.favorites.add(userId, food.ref);
  else await deps.favorites.remove(userId, food.ref);
  return ok(true);
}

export async function listCustomFoods(deps: FoodDeps, userId: string): Promise<FoodView[]> {
  const favorites = await favoriteIds(deps, userId);
  return (await deps.customFoods.list(userId)).map((f) => customToView(f, favorites));
}

function toCustomData(raw: unknown): Result<CustomFoodData> {
  const parsed = customFoodSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input", flat(parsed.error));
  const d = parsed.data;
  return ok({
    name: d.name,
    brand: d.brand,
    basis: d.basis,
    per100: {
      kcal: d.kcal100,
      protein: d.protein100,
      carbs: d.carbs100,
      fat: d.fat100,
      fiber: d.fiber100,
      sugars: d.sugars100,
      sodiumMg: d.sodiumMg100,
    },
    serving: d.servingSize != null ? { size: d.servingSize, label: d.servingLabel } : null,
  });
}

export async function createCustomFood(deps: FoodDeps, userId: string, raw: unknown): Promise<Result<FoodView>> {
  const data = toCustomData(raw);
  if (!data.ok) return data;
  const created = await deps.customFoods.create(userId, data.value);
  return ok(customToView(created, new Set()));
}

export async function updateCustomFood(deps: FoodDeps, userId: string, rawId: unknown, raw: unknown): Promise<Result<true>> {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return fail("invalid_input");
  const data = toCustomData(raw);
  if (!data.ok) return data;
  // Las comidas ya registradas no cambian: guardaron sus propios valores.
  return (await deps.customFoods.update(userId, id.data, data.value)) ? ok(true) : fail("not_found");
}

export async function deleteCustomFood(deps: FoodDeps, userId: string, rawId: unknown): Promise<Result<true>> {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return fail("invalid_input");
  return (await deps.customFoods.remove(userId, id.data)) ? ok(true) : fail("not_found");
}

export async function getCustomFood(deps: FoodDeps, userId: string, rawId: unknown): Promise<CustomFood | null> {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return null;
  return (await deps.customFoods.getMany(userId, [id.data]))[0] ?? null;
}
