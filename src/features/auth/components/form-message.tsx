import { cn } from "@/lib/utils";
import type { FormState } from "../form-state";

/** Mensaje general del formulario. Se anuncia a lectores de pantalla. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        state.status === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-foreground",
      )}
    >
      {state.message}
    </p>
  );
}
