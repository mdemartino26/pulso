import type { IsoDate } from "@/lib/calc";
import type { FoodRef, Meal, NutrientBasis, Per100, ProviderFood, Serving, ServingUnit } from "@/lib/food";

/** Alimento de la caché compartida (USDA / Open Food Facts) con su id. */
export type CachedFood = ProviderFood & { id: string; fetchedAt: string };

export interface CustomFood {
  id: string;
  name: string;
  brand: string | null;
  basis: NutrientBasis;
  per100: Per100;
  serving: Serving | null;
}

export type CustomFoodData = Omit<CustomFood, "id">;

export interface FoodEntry {
  id: string;
  date: IsoDate;
  meal: Meal;
  ref: FoodRef | null;
  name: string;
  brand: string | null;
  basis: NutrientBasis;
  quantity: number;
  unit: ServingUnit;
  basePerUnit: number;
  per100: Per100;
  /** Calculados por la base (columnas generadas). */
  amount: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
}

export type NewFoodEntry = Omit<FoodEntry, "id" | "amount" | "kcal" | "protein" | "carbs" | "fat" | "createdAt">;

/** Lectura de la caché con el cliente del usuario (RLS: solo lectura). */
export interface FoodCatalogRepository {
  getMany(ids: string[]): Promise<CachedFood[]>;
  findByBarcode(barcode: string): Promise<CachedFood | null>;
  /** Respaldo cuando los proveedores no responden. */
  searchByName(query: string, limit: number): Promise<CachedFood[]>;
}

/**
 * Escritura de la caché compartida. Es la ÚNICA parte que usa la clave
 * secreta de Supabase: los usuarios no pueden escribir esas tablas.
 */
export interface FoodCacheWriter {
  upsertFoods(foods: ProviderFood[]): Promise<CachedFood[]>;
  getSearch(provider: ProviderFood["source"], queryNorm: string): Promise<{ foodIds: string[]; fetchedAt: string } | null>;
  saveSearch(provider: ProviderFood["source"], queryNorm: string, foodIds: string[]): Promise<void>;
}

export interface CustomFoodRepository {
  list(userId: string): Promise<CustomFood[]>;
  getMany(userId: string, ids: string[]): Promise<CustomFood[]>;
  search(userId: string, query: string, limit: number): Promise<CustomFood[]>;
  create(userId: string, data: CustomFoodData): Promise<CustomFood>;
  update(userId: string, id: string, data: CustomFoodData): Promise<boolean>;
  remove(userId: string, id: string): Promise<boolean>;
}

export interface FoodEntryRepository {
  listByDate(userId: string, date: IsoDate): Promise<FoodEntry[]>;
  get(userId: string, id: string): Promise<FoodEntry | null>;
  insert(userId: string, entries: NewFoodEntry[]): Promise<void>;
  update(userId: string, id: string, patch: { meal: Meal; quantity: number; unit: ServingUnit; basePerUnit: number }): Promise<boolean>;
  remove(userId: string, id: string): Promise<boolean>;
  /** Últimas entradas (para "recientes"). */
  recent(userId: string, limit: number): Promise<FoodEntry[]>;
}

export interface FavoriteRepository {
  list(userId: string): Promise<FoodRef[]>;
  add(userId: string, ref: FoodRef): Promise<void>;
  remove(userId: string, ref: FoodRef): Promise<void>;
}

export interface RateLimiter {
  /** true si todavía hay cupo. */
  consume(bucket: "food_search" | "food_barcode" | "data_export", max: number, windowSeconds: number): Promise<boolean>;
}
