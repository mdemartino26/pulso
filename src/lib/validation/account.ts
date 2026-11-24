import { z } from "zod";

/** Confirmación escrita para borrar la cuenta (sin importar mayúsculas ni espacios). */
export const deleteAccountSchema = z.object({
  confirm: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z.literal("BORRAR"),
  ),
});
