import type { Intensity } from "@/lib/calc";
import type { ActivityCategory } from "@/server/repositories/activity-types";

/** Textos compartidos por pantallas de servidor y formularios del cliente. */
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  gym: "Gimnasio",
  cardio: "Cardio",
  sport: "Deportes",
  daily: "Vida diaria",
};

export const INTENSITY_LABELS: Record<Intensity, { label: string; hint: string }> = {
  low: { label: "Suave", hint: "Podés charlar sin esfuerzo" },
  moderate: { label: "Moderada", hint: "Charlás, pero te agitás" },
  high: { label: "Intensa", hint: "Cuesta decir una frase entera" },
};
