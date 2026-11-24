import { describe, expect, it } from "vitest";
import { addEntrySchema, barcodeSchema, customFoodSchema, searchQuerySchema } from "@/lib/validation/food";
import { basePerUnit, describePortion, mealForHour, normalizeQuery, nutrientsFor, sumNutrients, unitsFor } from ".";

const per100 = { kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, sugars: 0, sodiumMg: 2 };

describe("nutrientes", () => {
  it("calcula por cantidad con 1 decimal", () => {
    expect(nutrientsFor(per100, 40)).toEqual({ kcal: 155.6, protein: 6.8, carbs: 26.5, fat: 2.8 });
  });
  it("suma", () => {
    expect(sumNutrients([nutrientsFor(per100, 40), nutrientsFor(per100, 60)]).kcal).toBe(389);
  });
  it("porción y base", () => {
    expect(basePerUnit("serving", "g", { size: 30, label: "1 alfajor" })).toBe(30);
    expect(basePerUnit("serving", "g", null)).toBeNull();
    expect(basePerUnit("ml", "g", null)).toBeNull();
    expect(basePerUnit("ml", "ml", null)).toBe(1);
    expect(unitsFor("g", { size: 30, label: null })).toEqual(["serving", "g"]);
  });
  it("describe porciones", () => {
    expect(describePortion(150, "g", 1, "g")).toBe("150 g");
    expect(describePortion(1, "serving", 30, "g", "1 alfajor")).toBe("1 alfajor (30 g)");
    expect(describePortion(2, "serving", 30, "g", "1 alfajor")).toBe("2 × 1 alfajor (60 g)");
    expect(describePortion(2, "serving", 30, "g")).toBe("2 porciones (60 g)");
  });
});

describe("helpers", () => {
  it("comida según la hora", () => {
    expect(mealForHour(8)).toBe("breakfast");
    expect(mealForHour(13)).toBe("lunch");
    expect(mealForHour(17)).toBe("afternoon_snack");
    expect(mealForHour(21)).toBe("dinner");
    expect(mealForHour(2)).toBe("snack");
  });
  it("normaliza búsquedas", () => {
    expect(normalizeQuery("  Yogur   ENTERO ")).toBe("yogur entero");
  });
});

describe("validación", () => {
  const base = { source: "off", foodId: "8f14e45f-ceea-467f-a8e6-1a2b3c4d5e6f", date: "2026-11-24", meal: "lunch", quantity: "150,5", unit: "g" };
  it("acepta una entrada válida con coma decimal", () => {
    const r = addEntrySchema.safeParse(base);
    expect(r.success && r.data.quantity).toBe(150.5);
  });
  it("rechaza cantidades fuera de rango, ids y comidas inválidas", () => {
    expect(addEntrySchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
    expect(addEntrySchema.safeParse({ ...base, quantity: "999999" }).success).toBe(false);
    expect(addEntrySchema.safeParse({ ...base, foodId: "1 or 1=1" }).success).toBe(false);
    expect(addEntrySchema.safeParse({ ...base, meal: "brunch" }).success).toBe(false);
    expect(addEntrySchema.safeParse({ ...base, date: "2026-02-30" }).success).toBe(false);
  });
  it("búsqueda y código de barras", () => {
    expect(searchQuerySchema.safeParse("a").success).toBe(false);
    expect(searchQuerySchema.safeParse("yogur\u0000").success).toBe(false);
    expect(barcodeSchema.safeParse("7790580660000").success).toBe(true);
    expect(barcodeSchema.safeParse("123").success).toBe(false);
    expect(barcodeSchema.safeParse("../../etc").success).toBe(false);
  });
  it("alimento propio", () => {
    const ok = customFoodSchema.safeParse({ name: " Tarta de zapallitos ", basis: "g", kcal100: "180", protein100: "7", carbs100: "15", fat100: "10", brand: "", servingSize: "", servingLabel: "" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.name).toBe("Tarta de zapallitos");
      expect(ok.data.brand).toBeNull();
      expect(ok.data.servingSize).toBeNull();
    }
    // Un campo vacío no se toma como 0.
    expect(customFoodSchema.safeParse({ name: "x", basis: "g", kcal100: "", protein100: "1", carbs100: "1", fat100: "1" }).success).toBe(false);
    const bad = customFoodSchema.safeParse({ name: "x", basis: "g", kcal100: "100", protein100: "60", carbs100: "50", fat100: "0" });
    expect(bad.success).toBe(false);
    expect(customFoodSchema.safeParse({ name: "x", basis: "g", kcal100: "100", protein100: "1", carbs100: "1", fat100: "1", servingLabel: "1 porción" }).success).toBe(false);
  });
});
