/**
 * Tipos de alimentos compartidos por cliente y servidor. Los proveedores
 * externos (USDA, Open Food Facts) se normalizan a esta forma.
 */

export type FoodSource = "usda" | "off" | "custom";
export type NutrientBasis = "g" | "ml";
export type ServingUnit = "g" | "ml" | "serving";
export type Meal = "breakfast" | "lunch" | "afternoon_snack" | "dinner" | "snack";

export const MEALS: readonly Meal[] = ["breakfast", "lunch", "afternoon_snack", "dinner", "snack"];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  afternoon_snack: "Merienda",
  dinner: "Cena",
  snack: "Colaciones",
};

/** Valores cada 100 g (o 100 ml). */
export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugars: number | null;
  sodiumMg: number | null;
}

export interface Serving {
  /** Cuántos g/ml tiene una porción. */
  size: number;
  /** Ej. "1 alfajor", "1 taza". */
  label: string | null;
}

/** Alimento normalizado de un proveedor externo (antes de guardarlo en caché). */
export interface ProviderFood {
  source: Exclude<FoodSource, "custom">;
  sourceId: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  basis: NutrientBasis;
  per100: Per100;
  serving: Serving | null;
  imageUrl: string | null;
}

/** Referencia a un alimento que la app puede registrar. */
export interface FoodRef {
  source: FoodSource;
  /** id en foods_cache (usda/off) o en custom_foods (custom). */
  id: string;
}

/** Lo que ve el cliente: alimento listo para elegir porción. */
export interface FoodView {
  ref: FoodRef;
  name: string;
  brand: string | null;
  basis: NutrientBasis;
  per100: Per100;
  serving: Serving | null;
  imageUrl: string | null;
  favorite: boolean;
}

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
