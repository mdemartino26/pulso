import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./food";

/**
 * Esquemas de agua, peso, sueño, ánimo y hábitos. Los mismos en el
 * formulario y en el servidor; los rangos coinciden con los `check` de la base.
 */

const emptyToUndefined = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim().replace(",", ".")) : v);

const number = (min: number, max: number, msg: string, opts: { int?: boolean } = {}) =>
  z.preprocess(emptyToUndefined, (opts.int ? z.coerce.number({ error: msg }).int({ error: msg }) : z.coerce.number({ error: msg }))
    .refine(Number.isFinite, { error: msg })
    .min(min, { error: msg })
    .max(max, { error: msg }));

const optionalNumber = (min: number, max: number, msg: string, opts: { int?: boolean } = {}) =>
  z.preprocess(emptyToUndefined, number(min, max, msg, opts).optional());

export const addWaterSchema = z.object({
  date: isoDateSchema,
  amountMl: number(50, 3000, "Entre 50 y 3000 ml", { int: true }),
});

export const undoWaterSchema = z.object({ date: isoDateSchema });

export const weightSchema = z.object({
  date: isoDateSchema,
  weightKg: number(30, 300, "El peso va de 30 a 300 kg"),
});

export const deleteWeightSchema = z.object({ date: isoDateSchema });

export const MOODS = [1, 2, 3, 4, 5] as const;

export const wellbeingSchema = z
  .object({
    date: isoDateSchema,
    sleepHours: optionalNumber(0, 24, "Las horas de sueño van de 0 a 24"),
    mood: optionalNumber(1, 5, "Elegí cómo te sentiste", { int: true }),
  })
  .refine((v) => v.sleepHours !== undefined || v.mood !== undefined, {
    error: "Completá el sueño o el ánimo",
    path: ["sleepHours"],
  });

const habitName = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim() : v),
  z.string({ error: "Escribí un nombre" }).min(1, { error: "Escribí un nombre" }).max(60, { error: "Máximo 60 caracteres" }),
);

export const createHabitSchema = z.object({ name: habitName });
export const renameHabitSchema = z.object({ habitId: uuidSchema, name: habitName });
export const habitIdSchema = z.object({ habitId: uuidSchema });

export const toggleHabitSchema = z.object({
  habitId: uuidSchema,
  date: isoDateSchema,
  done: z.enum(["true", "false"]).transform((v) => v === "true"),
});
