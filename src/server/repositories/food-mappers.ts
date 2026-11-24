import type { Per100, Serving } from "@/lib/food";
import type { Database } from "@/server/db/database.types";
import type { CachedFood, CustomFood, CustomFoodData, FoodEntry } from "./food-types";

type Tables = Database["public"]["Tables"];

export const FOODS_CACHE_COLUMNS =
  "id, source, source_id, barcode, name, brand, basis, kcal_100, protein_100, carbs_100, fat_100, fiber_100, sugars_100, sodium_mg_100, serving_size, serving_label, image_url, fetched_at";

export const CUSTOM_FOOD_COLUMNS =
  "id, name, brand, basis, kcal_100, protein_100, carbs_100, fat_100, fiber_100, sugars_100, sodium_mg_100, serving_size, serving_label";

export const FOOD_ENTRY_COLUMNS =
  "id, date, meal, source, food_cache_id, custom_food_id, name, brand, basis, quantity, unit, base_per_unit, kcal_100, protein_100, carbs_100, fat_100, fiber_100, sugars_100, sodium_mg_100, amount, kcal, protein_g, carbs_g, fat_g, created_at";

// PostgREST devuelve `numeric` como número, pero por las dudas lo forzamos.
const n = (v: number | string) => Number(v);
const nn = (v: number | string | null) => (v === null ? null : Number(v));

type Per100Row = Pick<
  Tables["foods_cache"]["Row"],
  "kcal_100" | "protein_100" | "carbs_100" | "fat_100" | "fiber_100" | "sugars_100" | "sodium_mg_100"
>;

export function rowToPer100(r: Per100Row): Per100 {
  return {
    kcal: n(r.kcal_100),
    protein: n(r.protein_100),
    carbs: n(r.carbs_100),
    fat: n(r.fat_100),
    fiber: nn(r.fiber_100),
    sugars: nn(r.sugars_100),
    sodiumMg: nn(r.sodium_mg_100),
  };
}

export function per100ToRow(p: Per100) {
  return {
    kcal_100: p.kcal,
    protein_100: p.protein,
    carbs_100: p.carbs,
    fat_100: p.fat,
    fiber_100: p.fiber,
    sugars_100: p.sugars,
    sodium_mg_100: p.sodiumMg,
  };
}

function serving(size: number | null, label: string | null): Serving | null {
  return size === null ? null : { size: n(size), label };
}

export function rowToCachedFood(r: Tables["foods_cache"]["Row"]): CachedFood {
  return {
    id: r.id,
    source: r.source,
    sourceId: r.source_id,
    barcode: r.barcode,
    name: r.name,
    brand: r.brand,
    basis: r.basis,
    per100: rowToPer100(r),
    serving: serving(r.serving_size, r.serving_label),
    imageUrl: r.image_url,
    fetchedAt: r.fetched_at,
  };
}

export function rowToCustomFood(
  r: Pick<Tables["custom_foods"]["Row"], "id" | "name" | "brand" | "basis" | "serving_size" | "serving_label"> & Per100Row,
): CustomFood {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    basis: r.basis,
    per100: rowToPer100(r),
    serving: serving(r.serving_size, r.serving_label),
  };
}

export function customFoodToRow(d: CustomFoodData) {
  return {
    name: d.name,
    brand: d.brand,
    basis: d.basis,
    ...per100ToRow(d.per100),
    serving_size: d.serving?.size ?? null,
    serving_label: d.serving?.label ?? null,
  };
}

export function rowToFoodEntry(r: Omit<Tables["food_entries"]["Row"], "user_id" | "updated_at" | "fiber_g" | "sugars_g" | "sodium_mg">): FoodEntry {
  const ref =
    r.source === "custom"
      ? r.custom_food_id
        ? { source: r.source, id: r.custom_food_id }
        : null
      : r.food_cache_id
        ? { source: r.source, id: r.food_cache_id }
        : null;
  return {
    id: r.id,
    date: r.date,
    meal: r.meal,
    ref,
    name: r.name,
    brand: r.brand,
    basis: r.basis,
    quantity: n(r.quantity),
    unit: r.unit === "unit" ? "serving" : r.unit,
    basePerUnit: n(r.base_per_unit),
    per100: rowToPer100(r),
    amount: n(r.amount),
    kcal: n(r.kcal),
    protein: n(r.protein_g),
    carbs: n(r.carbs_g),
    fat: n(r.fat_g),
    createdAt: r.created_at,
  };
}
