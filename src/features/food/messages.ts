import type { ServiceError } from "@/server/services/food-service";

/** Textos para el usuario: amables y sin detalles internos. */
export const FOOD_MESSAGES: Record<ServiceError | "generic", string> = {
  invalid_input: "Revisá los datos marcados.",
  rate_limited: "Fueron muchos pedidos seguidos. Esperá un minuto y probá de nuevo.",
  not_found: "No encontramos ese alimento. Puede que se haya borrado.",
  unavailable: "Las bases de alimentos no responden ahora. Probá en un rato o cargalo a mano.",
  unit_not_available: "Esa unidad no está disponible para este alimento.",
  date_out_of_range: "Solo podés registrar comidas de hoy o de hasta un año atrás.",
  generic: "No pudimos guardar. Probá de nuevo en un momento.",
};
