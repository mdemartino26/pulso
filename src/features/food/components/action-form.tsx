"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState, type FormState } from "@/features/auth/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Botón que envía un formulario chico (copiar, borrar) y muestra el resultado. */
export function ActionButton({
  action,
  fields,
  children,
  pendingLabel,
  variant = "outline",
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  pendingLabel: string;
  variant?: "outline" | "secondary" | "ghost" | "destructive";
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="grid gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} disabled={pending} className={className}>
        {pending ? pendingLabel : children}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
