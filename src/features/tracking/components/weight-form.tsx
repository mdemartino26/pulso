"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState } from "@/features/auth/form-state";
import { logWeightAction } from "../actions";

/** Registrar el peso (hoy por defecto; se puede cargar un día anterior). */
export function WeightForm({ today, minDate, lastWeight }: { today: string; minDate: string; lastWeight: number | null }) {
  const [state, formAction, pending] = useActionState(logWeightAction, initialFormState);
  const [weight, setWeight] = useState("");
  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="weightKg">Peso (kg)</Label>
          <Input
            id="weightKg"
            name="weightKg"
            inputMode="decimal"
            autoComplete="off"
            placeholder={lastWeight ? lastWeight.toLocaleString("es-AR") : "Ej.: 68,5"}
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))}
            className="h-11 text-lg"
            aria-invalid={state.fieldErrors?.weightKg ? true : undefined}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="weightDate">Día</Label>
          <Input id="weightDate" name="date" type="date" defaultValue={today} max={today} min={minDate} className="h-11" />
        </div>
      </div>
      {state.fieldErrors?.weightKg ? <p className="text-destructive text-sm">{state.fieldErrors.weightKg[0]}</p> : null}
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending || weight === ""}>
        {pending ? "Guardando…" : "Guardar peso"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Si ya había un peso ese día, se reemplaza. Pesarte siempre en condiciones parecidas (por ejemplo, a la mañana)
        hace que la tendencia sea más fiel.
      </p>
    </form>
  );
}
