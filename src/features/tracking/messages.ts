import type { TrackingError } from "@/server/services/tracking-service";

/** Textos para el usuario: amables y sin detalles internos. */
export const TRACKING_MESSAGES: Record<TrackingError | "generic", string> = {
  invalid_input: "Revisá los datos marcados.",
  not_found: "No encontramos ese registro. Puede que ya se haya borrado.",
  date_out_of_range: "Solo podés registrar datos de hoy o de hasta un año atrás.",
  last_weight: "Necesitamos al menos un peso para calcular tus metas: cargá otro antes de borrar éste.",
  too_many_habits: "Llegaste al máximo de 20 hábitos. Archivá alguno para sumar otro.",
  generic: "No pudimos guardar. Probá de nuevo en un momento.",
};

export const MOOD_LABELS: Record<number, string> = {
  1: "Muy bajo",
  2: "Bajo",
  3: "Normal",
  4: "Bien",
  5: "Muy bien",
};
