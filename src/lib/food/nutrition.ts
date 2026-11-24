import type { Meal, NutrientBasis, Nutrients, Per100, Serving, ServingUnit } from "./types";

/** Cuántos g/ml equivale 1 unidad (null si la unidad no aplica a ese alimento). */
export function basePerUnit(unit: ServingUnit, basis: NutrientBasis, serving: Serving | null): number | null {
  if (unit === "serving") return serving ? serving.size : null;
  return unit === basis ? 1 : null;
}

/** Unidades posibles para un alimento: su base (g o ml) y, si tiene, la porción. */
export function unitsFor(basis: NutrientBasis, serving: Serving | null): ServingUnit[] {
  return serving ? ["serving", basis] : [basis];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Nutrientes de una cantidad. Mismo redondeo que las columnas generadas de
 * food_entries (1 decimal), para que la vista previa coincida con lo guardado.
 */
export function nutrientsFor(per100: Per100, amount: number): Nutrients {
  const f = amount / 100;
  return {
    kcal: round1(per100.kcal * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
  };
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  const total = items.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      carbs: acc.carbs + n.carbs,
      fat: acc.fat + n.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    kcal: round1(total.kcal),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
  };
}

/** Comida sugerida según la hora local (0–23). */
export function mealForHour(hour: number): Meal {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 19) return "afternoon_snack";
  if (hour >= 19 && hour < 23) return "dinner";
  return "snack";
}

/** Normaliza una búsqueda para la caché: minúsculas, sin espacios repetidos. */
export function normalizeQuery(q: string): string {
  return q.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100);
}

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** "150 g", "1 porción (30 g)", "2 porciones (60 g)". */
export function describePortion(
  quantity: number,
  unit: ServingUnit,
  basePerUnitValue: number,
  basis: NutrientBasis,
  servingLabel?: string | null,
): string {
  if (unit !== "serving") return `${nf.format(quantity)} ${unit}`;
  const total = `(${nf.format(quantity * basePerUnitValue)} ${basis})`;
  const label = servingLabel?.trim();
  if (label) return quantity === 1 ? `${label} ${total}` : `${nf.format(quantity)} × ${label} ${total}`;
  return `${nf.format(quantity)} ${quantity === 1 ? "porción" : "porciones"} ${total}`;
}
