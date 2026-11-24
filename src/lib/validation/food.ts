import { z } from "zod";
import { parseIsoDate } from "@/lib/calc";
import { MEALS } from "@/lib/food";

/**
 * Esquemas de comidas, compartidos por formularios y servidor.
 * El cliente NUNCA manda calorías ni nutrientes de un alimento de la base:
 * manda una referencia y la cantidad; el servidor busca los valores.
 */

const decimal = (min: number, max: number, msg: string) =>
  z.preprocess(
    // Vacío NO es 0: si falta el dato, es un error.
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim().replace(",", ".")) : v),
    z.coerce.number({ error: msg }).refine(Number.isFinite, { error: msg }).min(min, { error: msg }).max(max, { error: msg }),
  );

const optionalDecimal = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : typeof v === "string" ? v.trim().replace(",", ".") : v),
    z.coerce.number({ error: msg }).refine(Number.isFinite, { error: msg }).min(min, { error: msg }).max(max, { error: msg }).nullable(),
  );

export const isoDateSchema = z.string().refine(
  (v) => {
    try {
      parseIsoDate(v);
      return true;
    } catch {
      return false;
    }
  },
  { error: "Fecha inválida" },
);

export const mealSchema = z.enum(MEALS as [string, ...string[]], { error: "Elegí una comida" }).transform(
  (v) => v as (typeof MEALS)[number],
);

export const uuidSchema = z.uuid({ error: "Referencia inválida" });

export const foodRefSchema = z.object({
  source: z.enum(["usda", "off", "custom"]),
  id: uuidSchema,
});

export const quantitySchema = decimal(0.1, 10000, "Ingresá una cantidad mayor a 0");
export const servingUnitSchema = z.enum(["g", "ml", "serving"], { error: "Elegí una unidad" });

export const addEntrySchema = z.object({
  source: foodRefSchema.shape.source,
  foodId: uuidSchema,
  date: isoDateSchema,
  meal: mealSchema,
  quantity: quantitySchema,
  unit: servingUnitSchema,
});
export type AddEntryInput = z.output<typeof addEntrySchema>;

export const updateEntrySchema = z.object({
  entryId: uuidSchema,
  meal: mealSchema,
  quantity: quantitySchema,
  unit: servingUnitSchema,
});
export type UpdateEntryInput = z.output<typeof updateEntrySchema>;

export const copyDaySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  meal: z.union([mealSchema, z.literal("all")]).default("all"),
});

/** Búsqueda: texto corto y sin caracteres de control. */
export const searchQuerySchema = z
  .string()
  .trim()
  .min(2, { error: "Escribí al menos 2 letras" })
  .max(80, { error: "La búsqueda es demasiado larga" })
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), { error: "Búsqueda inválida" });

/** EAN-8, UPC-A (12), EAN-13 o GTIN-14. */
export const barcodeSchema = z.string().regex(/^(\d{8}|\d{12,14})$/, { error: "Código de barras inválido" });

const stripControl = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim() : v);

const requiredText = (max: number, msg: string) =>
  z.preprocess(stripControl, z.string({ error: msg }).min(1, { error: msg }).max(max, { error: `Máximo ${max} caracteres` }));

const optionalText = (max: number) =>
  z.preprocess(
    (v) => {
      const s = stripControl(v);
      return s === "" || s === undefined ? null : s;
    },
    z.string().max(max, { error: `Máximo ${max} caracteres` }).nullable(),
  );

/** Alimento propio. Valores cada 100 g/ml, con los mismos límites que la base. */
export const customFoodSchema = z
  .object({
    name: requiredText(120, "Poné un nombre"),
    brand: optionalText(120),
    basis: z.enum(["g", "ml"], { error: "Elegí gramos o mililitros" }),
    kcal100: decimal(0, 900, "Las calorías van de 0 a 900 cada 100"),
    protein100: decimal(0, 100, "Entre 0 y 100 g"),
    carbs100: decimal(0, 100, "Entre 0 y 100 g"),
    fat100: decimal(0, 100, "Entre 0 y 100 g"),
    fiber100: optionalDecimal(0, 100, "Entre 0 y 100 g"),
    sugars100: optionalDecimal(0, 100, "Entre 0 y 100 g"),
    sodiumMg100: optionalDecimal(0, 40000, "Entre 0 y 40.000 mg"),
    servingSize: optionalDecimal(0.1, 5000, "La porción va de 0,1 a 5000"),
    servingLabel: optionalText(60),
  })
  .superRefine((d, ctx) => {
    if (d.protein100 + d.carbs100 + d.fat100 > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["carbs100"],
        message: "Proteínas, carbohidratos y grasas no pueden sumar más de 100 g cada 100",
      });
    }
    if (d.servingLabel && d.servingSize == null) {
      ctx.addIssue({ code: "custom", path: ["servingSize"], message: "Indicá cuánto pesa la porción" });
    }
  });
export type CustomFoodInput = z.output<typeof customFoodSchema>;
