import { z } from "zod";
import type { ProviderFood } from "@/lib/food";
import { buildFood, cleanText, sanePer100, saneServing, toNumber } from "./sanitize";
import { ProviderError, fetchJson, type FetchLike, type FoodProvider } from "./types";

/**
 * Open Food Facts: base abierta con muchos productos argentinos y códigos
 * de barras. No necesita key, pero pide un User-Agent que identifique la app.
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

const FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "generic_name_es",
  "brands",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "product_quantity_unit",
  "nutrition_data_per",
  "image_front_small_url",
].join(",");

const productSchema = z.object({
  code: z.preprocess((v) => (typeof v === "number" ? String(v) : v), z.string()),
  product_name: z.string().optional(),
  product_name_es: z.string().optional(),
  generic_name_es: z.string().optional(),
  // La búsqueda nueva devuelve las marcas como lista; la vieja, como texto.
  brands: z.union([z.string(), z.array(z.string())]).optional(),
  nutriments: z.record(z.string(), z.unknown()).optional(),
  serving_size: z.string().optional(),
  serving_quantity: z.unknown().optional(),
  serving_quantity_unit: z.string().optional(),
  product_quantity_unit: z.string().optional(),
  image_front_small_url: z.string().optional(),
});

const productResponseSchema = z.object({ status: z.number().optional(), product: z.unknown().optional() });
const legacySearchSchema = z.object({ products: z.array(z.unknown()).max(200).default([]) });
const searchaliciousSchema = z.object({ hits: z.array(z.unknown()).max(200).default([]) });

export function parseOffProduct(raw: unknown): ProviderFood | null {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const n = p.nutriments ?? {};
  const num = (k: string) => toNumber(n[k]);
  const kj = num("energy_100g");
  const kcal = num("energy-kcal_100g") ?? (kj !== null ? kj / 4.184 : null);
  const sodiumG = num("sodium_100g") ?? (num("salt_100g") !== null ? (num("salt_100g") as number) / 2.5 : null);
  const per100 = sanePer100({
    kcal,
    protein: num("proteins_100g"),
    carbs: num("carbohydrates_100g"),
    fat: num("fat_100g"),
    fiber: num("fiber_100g"),
    sugars: num("sugars_100g"),
    sodiumMg: sodiumG !== null ? sodiumG * 1000 : null,
  });
  const qtyUnit = (p.product_quantity_unit ?? p.serving_quantity_unit ?? "").toLowerCase();
  const basis = qtyUnit === "ml" || qtyUnit === "cl" || qtyUnit === "l" ? "ml" : "g";
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(",")[0];
  return buildFood({
    source: "off",
    sourceId: p.code,
    barcode: p.code,
    name: cleanText(p.product_name_es, 200) ?? cleanText(p.product_name, 200) ?? cleanText(p.generic_name_es, 200),
    brand,
    basis,
    per100,
    serving: saneServing(toNumber(p.serving_quantity), p.serving_size),
    imageUrl: p.image_front_small_url,
  });
}

export interface OffOptions {
  userAgent: string;
  fetchFn?: FetchLike;
  baseUrl?: string;
  searchBaseUrl?: string;
}

/** Las búsquedas de texto de Open Food Facts pueden tardar bastante. */
const SEARCH_TIMEOUT_MS = 10_000;

export function createOpenFoodFactsProvider({
  userAgent,
  fetchFn = fetch,
  baseUrl = "https://world.openfoodfacts.org",
  searchBaseUrl = "https://search.openfoodfacts.org",
}: OffOptions): FoodProvider {
  const headers = { "User-Agent": userAgent, Accept: "application/json" };
  return {
    source: "off",
    async search(query) {
      // 1) Buscador nuevo (search.openfoodfacts.org): rápido y pensado para esto.
      // 2) Si falla, la búsqueda clásica (más lenta).
      try {
        const url = new URL(`${searchBaseUrl}/search`);
        url.searchParams.set("q", query);
        url.searchParams.set("page_size", "25");
        url.searchParams.set("langs", "es,en");
        url.searchParams.set("fields", FIELDS);
        const json = await fetchJson(fetchFn, "off", url.toString(), { headers }, SEARCH_TIMEOUT_MS);
        const parsed = searchaliciousSchema.safeParse(json ?? {});
        if (!parsed.success) throw new ProviderError("off", "invalid_response");
        return parsed.data.hits.map(parseOffProduct).filter((f): f is ProviderFood => f !== null);
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e;
        console.warn("[food] off (buscador nuevo) falló, probamos el clásico", { code: e.code, status: e.status });
      }
      const url = new URL(`${baseUrl}/cgi/search.pl`);
      url.searchParams.set("search_terms", query);
      url.searchParams.set("search_simple", "1");
      url.searchParams.set("action", "process");
      url.searchParams.set("json", "1");
      url.searchParams.set("page_size", "25");
      url.searchParams.set("fields", FIELDS);
      const json = await fetchJson(fetchFn, "off", url.toString(), { headers }, SEARCH_TIMEOUT_MS);
      if (json === null) return [];
      const parsed = legacySearchSchema.safeParse(json);
      if (!parsed.success) throw new ProviderError("off", "invalid_response");
      return parsed.data.products.map(parseOffProduct).filter((f): f is ProviderFood => f !== null);
    },
    async byBarcode(barcode) {
      // El código ya viene validado (solo dígitos), así que no puede cambiar la ruta.
      const url = new URL(`${baseUrl}/api/v2/product/${barcode}`);
      url.searchParams.set("fields", FIELDS);
      const json = await fetchJson(fetchFn, "off", url.toString(), { headers });
      if (json === null) return null;
      const parsed = productResponseSchema.safeParse(json);
      if (!parsed.success) throw new ProviderError("off", "invalid_response");
      if (parsed.data.status !== 1 || !parsed.data.product) return null;
      return parseOffProduct(parsed.data.product);
    },
  };
}
