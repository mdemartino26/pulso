/** Estado que devuelven las Server Actions de los formularios. */
export interface FormState {
  status: "idle" | "error" | "success";
  /** Mensaje general para mostrar arriba del botón. */
  message?: string;
  /** Errores por campo (los mismos textos que da Zod en el cliente). */
  fieldErrors?: Record<string, string[] | undefined>;
  /** Email ingresado, para no hacerlo tipear de nuevo si algo falla. */
  email?: string;
}

export const initialFormState: FormState = { status: "idle" };
