"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState } from "@/features/auth/form-state";
import { saveStepsAction } from "../actions";

/** Pasos del día, cargados a mano (o copiados del celular/reloj). */
export function StepsForm({ date, steps }: { date: string; steps: number | null }) {
  const [state, formAction, pending] = useActionState(saveStepsAction, initialFormState);
  const [value, setValue] = useState(steps === null ? "" : String(steps));
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="date" value={date} />
      <Label htmlFor="steps">Pasos del día</Label>
      <div className="flex gap-2">
        <Input
          id="steps"
          name="steps"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ej.: 8500"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-11 flex-1 text-lg"
          aria-invalid={state.fieldErrors?.steps ? true : undefined}
        />
        <Button type="submit" className="h-11" disabled={pending || value === ""}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {state.fieldErrors?.steps ? <p className="text-destructive text-sm">{state.fieldErrors.steps[0]}</p> : null}
      <FormMessage state={state} />
    </form>
  );
}
