"use client";

import { Button } from "@/components/ui/button";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { forgotPasswordAction } from "../actions";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { useValidatedAction } from "./use-validated-action";

export function ForgotPasswordForm() {
  const { state, formAction, pending, onSubmit, fieldErrors } = useValidatedAction(
    forgotPasswordSchema,
    forgotPasswordAction,
  );

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        errors={fieldErrors?.email}
      />
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enviando…" : "Mandarme el link"}
      </Button>
    </form>
  );
}
