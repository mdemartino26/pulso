import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./food";

/**
 * Esquemas de actividad, compartidos por formularios y servidor.
 * El cliente nunca manda calorías ni MET: manda qué hizo, cuánto y con qué
 * intensidad; el servidor busca el MET en la tabla y calcula.
 */

const int = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
    z.coerce.number({ error: msg }).int({ error: msg }).min(min, { error: msg }).max(max, { error: msg }),
  );

const decimal = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim().replace(",", ".")) : v),
    z.coerce.number({ error: msg }).refine(Number.isFinite, { error: msg }).min(min, { error: msg }).max(max, { error: msg }),
  );

export const intensitySchema = z.enum(["low", "moderate", "high"], { error: "Elegí la intensidad" });

export const strengthSetSchema = z.object({
  exerciseId: int(1, 32767, "Elegí un ejercicio"),
  reps: int(1, 200, "Repeticiones: de 1 a 200"),
  weightKg: decimal(0, 500, "Peso: de 0 a 500 kg"),
});
export type StrengthSetInput = z.output<typeof strengthSetSchema>;

/** Las series llegan como JSON en un campo oculto del formulario. */
const setsField = z.preprocess(
  (v) => {
    if (v === undefined || v === "") return [];
    if (typeof v !== "string" || v.length > 20_000) return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },
  z.array(strengthSetSchema, { error: "Revisá las series" }).max(50, { error: "Máximo 50 series por actividad" }),
);

const activityFields = {
  metActivityId: int(1, 32767, "Elegí una actividad"),
  intensity: intensitySchema,
  durationMin: int(1, 600, "La duración va de 1 a 600 minutos"),
  sets: setsField,
};

export const addActivitySchema = z.object({ date: isoDateSchema, ...activityFields });
export type AddActivityInput = z.output<typeof addActivitySchema>;

export const updateActivitySchema = z.object({ entryId: uuidSchema, ...activityFields });
export type UpdateActivityInput = z.output<typeof updateActivitySchema>;

export const stepsSchema = z.object({
  date: isoDateSchema,
  steps: int(0, 100000, "Los pasos van de 0 a 100.000"),
});
