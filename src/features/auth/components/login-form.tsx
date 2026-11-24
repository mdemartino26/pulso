"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signInSchema } from "@/lib/validation/auth";
import { signInAction } from "../actions";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { useValidatedAction } from "./use-validated-action";

export function LoginForm({ next }: { next?: string | undefined }) {
  const { state, formAction, pending, onSubmit, fieldErrors } = useValidatedAction(
    signInSchema,
    signInAction,
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
        autoComplete="current-password"
        required
        errors={fieldErrors?.password}
      />
      <div className="-mt-2 text-right">
        <Link href="/recuperar-contrasena" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
          ¿Te olvidaste la contraseña?
        </Link>
      </div>
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
