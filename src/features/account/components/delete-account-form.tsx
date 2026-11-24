"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState } from "@/features/auth/form-state";
import { deleteAccountAction } from "../actions";

/** Borrar la cuenta: hay que escribir BORRAR para habilitar el botón. */
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialFormState);
  const [confirm, setConfirm] = useState("");
  const ready = confirm.trim().toUpperCase() === "BORRAR";
  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="confirm">Para confirmar, escribí BORRAR</Label>
        <Input
          id="confirm"
          name="confirm"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11"
          aria-invalid={state.fieldErrors?.confirm ? true : undefined}
        />
        {state.fieldErrors?.confirm ? <p className="text-destructive text-sm">{state.fieldErrors.confirm[0]}</p> : null}
      </div>
      <FormMessage state={state} />
      <Button type="submit" variant="destructive" disabled={!ready || pending}>
        {pending ? "Borrando…" : "Borrar mi cuenta para siempre"}
      </Button>
    </form>
  );
}
