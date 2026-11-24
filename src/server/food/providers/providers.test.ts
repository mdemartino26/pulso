import { describe, expect, it, vi } from "vitest";
import { createOpenFoodFactsProvider, parseOffProduct } from "./open-food-facts";
import { cleanText, saneImageUrl } from "./sanitize";
import { ProviderError, type FetchLike } from "./types";
import { createUsdaProvider, parseUsdaFood } from "./usda";

const usdaBanana = {
  fdcId: 1105314,
  description: "BANANAS, RAW",
  dataType: "Foundation",
  foodNutrients: [
    { nutrientId: 1008, unitName: "KCAL", value: 89 },
    { nutrientId: 1003, unitName: "G", value: 1.09 },
    { nutrientId: 1005, unitName: "G", value: 22.84 },
    { nutrientId: 1004, unitName: "G", value: 0.33 },
    { nutrientId: 1079, unitName: "G", value: 2.6 },
    { nutrientId: 1093, unitName: "MG", value: 1 },
  ],
};

const offAlfajor = {
  code: "7790580660000",
  product_name: "Alfajor triple",
  product_name_es: "Alfajor triple chocolate",
  brands: "Marca X, Otra",
  nutriments: {
    "energy-kcal_100g": 450,
    proteins_100g: "5,5",
    carbohydrates_100g: 62,
    fat_100g: 20,
    sugars_100g: 35,
    sodium_100g: 0.2,
  },
  serving_size: "1 alfajor (55 g)",
  serving_quantity: "55",
  product_quantity_unit: "g",
  image_front_small_url: "https://images.openfoodfacts.org/images/products/779/058/066/0000/front_es.3.200.jpg",
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("USDA", () => {
  it("normaliza un alimento", () => {
    const f = parseUsdaFood(usdaBanana);
    expect(f).toMatchObject({
      source: "usda",
      sourceId: "1105314",
      name: "Bananas, raw",
      basis: "g",
      per100: { kcal: 89, protein: 1.09, carbs: 22.84, fat: 0.33, fiber: 2.6, sugars: null, sodiumMg: 1 },
      imageUrl: null,
    });
  });
  it("descarta alimentos sin calorías o con valores absurdos", () => {
    expect(parseUsdaFood({ ...usdaBanana, foodNutrients: [] })).toBeNull();
    expect(
      parseUsdaFood({ ...usdaBanana, foodNutrients: usdaBanana.foodNutrients.map((n) => (n.nutrientId === 1004 ? { ...n, value: 400 } : n)) }),
    ).toBeNull();
    expect(parseUsdaFood({ fdcId: "x" })).toBeNull();
  });
  it("manda la key en un header, no en la URL", async () => {
    const fetchFn = vi.fn<FetchLike>(() => json({ foods: [usdaBanana, { basura: true }] }));
    const p = createUsdaProvider({ apiKey: "clave-secreta-123", fetchFn });
    const foods = await p.search("banana");
    expect(foods).toHaveLength(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).not.toContain("clave-secreta");
    expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("clave-secreta-123");
    expect(init?.redirect).toBe("error");
  });
  it("errores HTTP sin detalles", async () => {
    const p = createUsdaProvider({ apiKey: "k".repeat(12), fetchFn: () => json({ error: "interno" }, 500) });
    await expect(p.search("banana")).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("Open Food Facts", () => {
  it("normaliza un producto (coma decimal, marca, porción, sodio en mg)", () => {
    const f = parseOffProduct(offAlfajor);
    expect(f).toMatchObject({
      source: "off",
      sourceId: "7790580660000",
      barcode: "7790580660000",
      name: "Alfajor triple chocolate",
      brand: "Marca X",
      per100: { kcal: 450, protein: 5.5, carbs: 62, fat: 20, sugars: 35, sodiumMg: 200 },
      serving: { size: 55, label: "1 alfajor (55 g)" },
    });
    expect(f?.imageUrl).toContain("images.openfoodfacts.org");
  });
  it("convierte kJ a kcal y detecta líquidos", () => {
    const f = parseOffProduct({
      code: "7790000000001",
      product_name: "Gaseosa",
      product_quantity_unit: "ml",
      nutriments: { energy_100g: 176, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 },
    });
    expect(f?.basis).toBe("ml");
    expect(f?.per100.kcal).toBe(42.1);
  });
  it("trata los datos externos como no confiables", () => {
    const f = parseOffProduct({
      ...offAlfajor,
      product_name_es: "<img src=x onerror=alert(1)>\u0000\u202e  Rico",
      image_front_small_url: "javascript:alert(1)",
      brands: "x".repeat(500),
    });
    // El texto se guarda tal cual (React lo escapa al mostrarlo), sin caracteres de control.
    expect(f?.name).toBe("<img src=x onerror=alert(1)> Rico");
    expect(f?.imageUrl).toBeNull();
    expect(f?.brand?.length).toBe(120);
    expect(parseOffProduct({ ...offAlfajor, code: "../../admin" })).toBeNull();
    expect(parseOffProduct({ ...offAlfajor, nutriments: { "energy-kcal_100g": -5 } })).toBeNull();
  });
  it("producto inexistente → null", async () => {
    const p = createOpenFoodFactsProvider({ userAgent: "Pulso/test", fetchFn: () => json({ status: 0 }) });
    expect(await p.byBarcode("7790000000001")).toBeNull();
  });
  it("manda User-Agent y no sigue redirecciones", async () => {
    const fetchFn = vi.fn<FetchLike>(() => json({ status: 1, product: offAlfajor }));
    const p = createOpenFoodFactsProvider({ userAgent: "Pulso/test", fetchFn });
    expect((await p.byBarcode("7790580660000"))?.name).toBe("Alfajor triple chocolate");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toContain("/api/v2/product/7790580660000");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("Pulso/test");
    expect(init?.redirect).toBe("error");
  });
  it("usa el buscador nuevo (marcas como lista) y, si falla, el clásico", async () => {
    const hit = { ...offAlfajor, brands: ["Marca X", "Otra"] };
    const ok1 = createOpenFoodFactsProvider({ userAgent: "x", fetchFn: () => json({ hits: [hit], count: 1 }) });
    expect((await ok1.search("alfajor"))[0]?.brand).toBe("Marca X");

    const fetchFn = vi.fn<FetchLike>((url) =>
      url.includes("search.openfoodfacts.org") ? json({ error: "busy" }, 503) : json({ products: [offAlfajor] }),
    );
    const p = createOpenFoodFactsProvider({ userAgent: "x", fetchFn });
    expect(await p.search("alfajor")).toHaveLength(1);
    expect(fetchFn.mock.calls.map(([u]) => new URL(u).host)).toEqual(["search.openfoodfacts.org", "world.openfoodfacts.org"]);
  });

  it("timeout → ProviderError", async () => {
    const err = Object.assign(new Error("t"), { name: "TimeoutError" });
    const p = createOpenFoodFactsProvider({ userAgent: "x", fetchFn: () => Promise.reject(err) });
    await expect(p.search("yogur")).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("sanitize", () => {
  it("limpia texto e imágenes", () => {
    expect(cleanText("  hola\n\tmundo ", 50)).toBe("hola mundo");
    expect(cleanText("", 5)).toBeNull();
    expect(saneImageUrl("http://images.openfoodfacts.org/a.jpg")).toBeNull();
    expect(saneImageUrl("https://images.openfoodfacts.org.evil.com/a.jpg")).toBeNull();
    expect(saneImageUrl("https://images.openfoodfacts.org/images/a.jpg")).not.toBeNull();
  });
});
