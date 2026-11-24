import type { NutrientBasis, Per100, ProviderFood, Serving } from "@/lib/food";

/*
 * Los datos de las APIs externas NO son confiables: pueden venir
 * incompletos, con valores absurdos o con texto raro. Todo pasa por acá
 * antes de guardarse o mostrarse, con los mismos límites que la base.
 */

/** Texto plano: sin caracteres de control, espacios colapsados, largo máximo. */
export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Número finito (acepta "12,5" o "12.5"); si no, null. */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function inRange(v: number | null, min: number, max: number, decimals: number): number | null {
  if (v === null || v < min || v > max) return null;
  return round(v, decimals);
}

/**
 * Valida los nutrientes cada 100. Devuelve null si falta lo esencial o si
 * los números no tienen sentido (así no se guarda basura).
 */
export function sanePer100(raw: {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
  sugars?: number | null;
  sodiumMg?: number | null;
}): Per100 | null {
  const kcal = inRange(raw.kcal, 0, 900, 1);
  const protein = inRange(raw.protein, 0, 100, 2);
  const carbs = inRange(raw.carbs, 0, 100, 2);
  const fat = inRange(raw.fat, 0, 100, 2);
  if (kcal === null || protein === null || carbs === null || fat === null) return null;
  // Margen por redondeos de etiqueta, pero no más de ~105 g cada 100 g.
  if (protein + carbs + fat > 105) return null;
  return {
    kcal,
    protein,
    carbs,
    fat,
    fiber: inRange(raw.fiber ?? null, 0, 100, 2),
    sugars: inRange(raw.sugars ?? null, 0, 100, 2),
    sodiumMg: inRange(raw.sodiumMg ?? null, 0, 40000, 1),
  };
}

export function saneServing(size: number | null, label: unknown): Serving | null {
  const s = inRange(size, 0.1, 5000, 1);
  if (s === null) return null;
  return { size: s, label: cleanText(label, 60) };
}

const OFF_IMAGE = /^https:\/\/images\.openfoodfacts\.org\/[A-Za-z0-9/_.\-]+\.(?:jpg|jpeg|png|webp)$/;

/** Solo imágenes https de Open Food Facts (coincide con la CSP y con la base). */
export function saneImageUrl(v: unknown): string | null {
  return typeof v === "string" && v.length <= 300 && OFF_IMAGE.test(v) ? v : null;
}

export function saneBarcode(v: unknown): string | null {
  return typeof v === "string" && /^[0-9]{8,14}$/.test(v) ? v : null;
}

export function buildFood(f: {
  source: ProviderFood["source"];
  sourceId: unknown;
  barcode: unknown;
  name: unknown;
  brand: unknown;
  basis: NutrientBasis;
  per100: Per100 | null;
  serving: Serving | null;
  imageUrl: unknown;
}): ProviderFood | null {
  const sourceId = typeof f.sourceId === "string" || typeof f.sourceId === "number" ? String(f.sourceId) : null;
  const name = cleanText(f.name, 200);
  if (!sourceId || !/^[A-Za-z0-9_-]{1,64}$/.test(sourceId) || !name || !f.per100) return null;
  return {
    source: f.source,
    sourceId,
    barcode: saneBarcode(f.barcode),
    name,
    brand: cleanText(f.brand, 120),
    basis: f.basis,
    per100: f.per100,
    serving: f.serving,
    imageUrl: saneImageUrl(f.imageUrl),
  };
}
