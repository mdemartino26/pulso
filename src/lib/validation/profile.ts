import { z } from "zod";
import {
  ACTIVITY_FACTORS,
  WEEKLY_RATE_OPTIONS,
  ageOn,
  bmrMifflinStJeor,
  checkGoalSafety,
  isValidTimeZone,
  parseIsoDate,
  type IsoDate,
} from "@/lib/calc";

/**
 * Esquema del perfil, compartido por el formulario y el servidor.
 * Incluye los límites de seguridad (ritmo ≤ 1 % del peso y meta ≥ piso):
 * el formulario avisa antes de enviar y el servidor rechaza igual.
 */

export const MIN_AGE = 18;
export const MAX_AGE = 100;

/** Acepta "70,5" (coma decimal) además de "70.5". */
const decimal = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(",", ".") : v),
    z.coerce
      .number({ error: `Ingresá ${label}` })
      .refine(Number.isFinite, { error: `Ingresá ${label}` })
      .min(min, { error: `Revisá ${label}: tiene que estar entre ${min} y ${max}` })
      .max(max, { error: `Revisá ${label}: tiene que estar entre ${min} y ${max}` }),
  );

const sex = z.enum(["female", "male"], { error: "Elegí una opción" });
const activityLevel = z.enum(["sedentary", "light", "moderate", "high"], {
  error: "Elegí tu nivel de actividad",
});
const goal = z.enum(["lose", "maintain", "gain"], { error: "Elegí tu objetivo" });

export type SafetyMessageCode = "rate_above_max" | "below_min_kcal";

export interface ProfileSchemaOptions {
  /** Fecha de hoy en la zona del usuario (para calcular la edad). */
  today: IsoDate;
  /** Onboarding: exige aceptar el aviso de salud. */
  requireHealthAck: boolean;
}

export function makeProfileSchema({ today, requireHealthAck }: ProfileSchemaOptions) {
  return z
    .object({
      sex,
      birthDate: z
        .string({ error: "Ingresá tu fecha de nacimiento" })
        .refine(
          (v) => {
            try {
              parseIsoDate(v);
              return true;
            } catch {
              return false;
            }
          },
          // abort: si la fecha no es válida, no seguimos con los otros chequeos.
          { error: "Ingresá tu fecha de nacimiento", abort: true },
        )
        .refine((v) => v <= today && ageOn(v, today) >= MIN_AGE, {
          error: `Pulso es para personas de ${MIN_AGE} años o más`,
          abort: true,
        })
        .refine((v) => ageOn(v, today) <= MAX_AGE, { error: "Revisá la fecha de nacimiento" }),
      heightCm: decimal(100, 250, "tu altura (cm)"),
      weightKg: decimal(30, 300, "tu peso (kg)"),
      activityLevel,
      timezone: z.string().refine(isValidTimeZone, { error: "Elegí una zona horaria válida" }),
      goal,
      weeklyRateKg: z.preprocess(
        (v) => (typeof v === "string" ? v.replace(",", ".") : v),
        z.coerce.number().default(0),
      ),
      waterGoalOverrideMl: z.preprocess(
        (v) => (v === "" || v === undefined ? null : v),
        z.coerce
          .number()
          .int()
          .min(500, { error: "La meta de agua tiene que estar entre 500 y 6000 ml" })
          .max(6000, { error: "La meta de agua tiene que estar entre 500 y 6000 ml" })
          .nullable(),
      ),
      healthAck: requireHealthAck
        ? z.literal("on", { error: "Necesitamos que leas y aceptes este aviso" })
        : z.string().optional(),
    })
    .transform((data) => ({
      ...data,
      // Mantener siempre tiene ritmo 0.
      weeklyRateKg: data.goal === "maintain" ? 0 : data.weeklyRateKg,
    }))
    .superRefine((data, ctx) => {
      if (data.goal === "maintain") return;
      if (!(WEEKLY_RATE_OPTIONS as readonly number[]).includes(data.weeklyRateKg)) {
        ctx.addIssue({ code: "custom", path: ["weeklyRateKg"], message: "Elegí un ritmo semanal" });
        return;
      }
      const safety = goalSafety(data, today);
      if (!safety.ok) {
        ctx.addIssue({
          code: "custom",
          path: ["weeklyRateKg"],
          message: safetyMessage(safety.issues[0] ?? "rate_above_max", data.goal, safety.suggestedRateKg),
        });
      }
    });
}

export type ProfileInput = z.output<ReturnType<typeof makeProfileSchema>>;

/** Chequeo de seguridad del objetivo a partir de los datos del formulario. */
export function goalSafety(
  data: Pick<ProfileInput, "sex" | "birthDate" | "heightCm" | "weightKg" | "activityLevel" | "goal" | "weeklyRateKg">,
  today: IsoDate,
) {
  const bmr = bmrMifflinStJeor({
    sex: data.sex,
    weightKg: data.weightKg,
    heightCm: data.heightCm,
    ageYears: ageOn(data.birthDate, today),
  });
  return checkGoalSafety({
    sex: data.sex,
    weightKg: data.weightKg,
    goal: data.goal,
    weeklyRateKg: data.weeklyRateKg,
    baseTdee: bmr * ACTIVITY_FACTORS[data.activityLevel],
  });
}

const fmtKg = (kg: number) => kg.toLocaleString("es-AR", { maximumFractionDigits: 2 });

/** Aviso amable y explicativo (nada de "error"). */
export function safetyMessage(
  issue: SafetyMessageCode,
  goal: "lose" | "maintain" | "gain",
  suggestedRateKg: number | null,
): string {
  const suggestion =
    suggestedRateKg != null
      ? ` Te proponemos ${fmtKg(suggestedRateKg)} kg por semana: es un ritmo que se puede sostener.`
      : " Con tus datos actuales, lo más cuidado es empezar manteniendo tu peso y revisar el plan con un profesional.";

  if (goal === "gain") {
    return `Subir más de 0,5 kg por semana suele sumar más grasa que músculo.${suggestion}`;
  }
  if (issue === "rate_above_max") {
    return `Bajar más del 1 % de tu peso por semana aumenta la pérdida de músculo y es difícil de sostener.${suggestion}`;
  }
  return `Con ese ritmo tu meta diaria quedaría por debajo del mínimo recomendado para cubrir tus necesidades básicas.${suggestion}`;
}
