import { z } from "zod";
import type { ProviderFood } from "@/lib/food";
import { buildFood, cleanText, sanePer100, saneServing, toNumber } from "./sanitize";
import { ProviderError, fetchJson, type FetchLike, type FoodProvider } from "./types";

/**
 * USDA FoodData Central. La API key viaja en un header (no en la URL, así
 * no queda en logs de proxies) y solo existe en el servidor.
 * Docs: https://fdc.nal.usda.gov/api-guide
 */

const nutrientSchema = z.object({
  nutrientId: z.number().optional(),
  nutrientNumber: z.string().optional(),
  unitName: z.string().optional(),
  value: z.unknown(),
});

const foodSchema = z.object({
  fdcId: z.number().int().positive(),
  description: z.string(),
  dataType: z.string().optional(),
  brandOwner: z.string().optional(),
  brandName: z.string().optional(),
  gtinUpc: z.string().optional(),
  servingSize: z.unknown().optional(),
  servingSizeUnit: z.string().optional(),
  householdServingFullText: z.string().optional(),
  foodNutrients: z.array(nutrientSchema).max(500).default([]),
});

const searchSchema = z.object({ foods: z.array(z.unknown()).max(200).default([]) });

// Ids de nutrientes de FDC.
const N = {
  kcal: [1008, 2047, 2048],
  protein: [1003],
  carbs: [1005],
  fat: [1004],
  fiber: [1079],
  sugars: [2000, 1063],
  sodium: [1093],
} as const;

function pick(nutrients: z.infer<typeof nutrientSchema>[], ids: readonly number[]): number | null {
  for (const id of ids) {
    const n = nutrients.find((x) => x.nutrientId === id);
    const v = n ? toNumber(n.value) : null;
    if (v !== null) {
      // Algunas energías vienen en kJ.
      if (ids === N.kcal && n?.unitName?.toLowerCase() === "kj") return v / 4.184;
      return v;
    }
  }
  return null;
}

/** Los nombres de USDA vienen en mayúsculas a veces: "BANANAS, RAW" → "Bananas, raw". */
function tidyName(name: string): string {
  return name === name.toUpperCase() ? name.charAt(0) + name.slice(1).toLowerCase() : name;
}

export function parseUsdaFood(raw: unknown): ProviderFood | null {
  const parsed = foodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const f = parsed.data;
  const per100 = sanePer100({
    kcal: pick(f.foodNutrients, N.kcal),
    protein: pick(f.foodNutrients, N.protein),
    carbs: pick(f.foodNutrients, N.carbs),
    fat: pick(f.foodNutrients, N.fat),
    fiber: pick(f.foodNutrients, N.fiber),
    sugars: pick(f.foodNutrients, N.sugars),
    sodiumMg: pick(f.foodNutrients, N.sodium),
  });
  const unit = f.servingSizeUnit?.toLowerCase();
  const basis = unit === "ml" ? "ml" : "g";
  const serving = unit === "g" || unit === "grm" || unit === "ml" ? saneServing(toNumber(f.servingSize), f.householdServingFullText) : null;
  return buildFood({
    source: "usda",
    sourceId: String(f.fdcId),
    barcode: f.gtinUpc?.replace(/^0+(?=\d{8,14}$)/, "") ?? null,
    name: tidyName(f.description),
    brand: cleanText(f.brandName ?? f.brandOwner, 120),
    basis,
    per100,
    serving,
    imageUrl: null,
  });
}

export interface UsdaOptions {
  apiKey: string;
  fetchFn?: FetchLike;
  baseUrl?: string;
}

export function createUsdaProvider({ apiKey, fetchFn = fetch, baseUrl = "https://api.nal.usda.gov/fdc/v1" }: UsdaOptions): FoodProvider {
  const headers = { "X-Api-Key": apiKey, Accept: "application/json" };

  async function search(query: string, pageSize: number): Promise<ProviderFood[]> {
    const url = new URL(`${baseUrl}/foods/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", String(pageSize));
    const json = await fetchJson(fetchFn, "usda", url.toString(), { headers });
    if (json === null) return [];
    const parsed = searchSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError("usda", "invalid_response");
    return parsed.data.foods.map(parseUsdaFood).filter((f): f is ProviderFood => f !== null);
  }

  return {
    source: "usda",
    search: (query) => search(query, 25),
    async byBarcode(barcode) {
      const foods = await search(barcode, 5);
      return foods.find((f) => f.barcode === barcode.replace(/^0+(?=\d{8,14}$)/, "")) ?? null;
    },
  };
}
