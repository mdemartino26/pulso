import type { ActivityError } from "@/server/services/activity-service";

/** Textos para el usuario: amables y sin detalles internos. */
export const ACTIVITY_MESSAGES: Record<ActivityError | "generic", string> = {
  invalid_input: "Revisá los datos marcados.",
  not_found: "No encontramos esa actividad. Puede que se haya borrado.",
  date_out_of_range: "Solo podés registrar actividad de hoy o de hasta un año atrás.",
  no_weight: "Necesitamos tu peso para calcular las calorías. Cargalo en tu perfil.",
  generic: "No pudimos guardar. Probá de nuevo en un momento.",
};
