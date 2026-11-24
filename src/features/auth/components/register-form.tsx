"use client";

import { Button } from "@/components/ui/button";
import { signUpSchema } from "@/lib/validation/auth";
import { signUpAction } from "../actions";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { useValidatedAction } from "./use-validated-action";

export function RegisterForm() {
  const { state, formAction, pending, onSubmit, fieldErrors } = useValidatedAction(
    signUpSchema,
    signUpAction,
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
        defaultValue={state.email}
        errors={fieldErrors?.email}
      />
      <FormField
        name="password"
        label="Contraseña"
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
        {pending ? "Creando tu cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
