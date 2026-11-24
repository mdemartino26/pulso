"use client";

import { Button } from "@/components/ui/button";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPasswordAction } from "../actions";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { useValidatedAction } from "./use-validated-action";

export function ResetPasswordForm() {
  const { state, formAction, pending, onSubmit, fieldErrors } = useValidatedAction(
    resetPasswordSchema,
    resetPasswordAction,
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField
        name="password"
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 10 caracteres, con letras y números."
        errors={fieldErrors?.password}
      />
      <FormField
        name="confirmPassword"
        label="Repetí la contraseña"
        type="password"
        autoComplete="new-password"
        required
        errors={fieldErrors?.confirmPassword}
      />
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
