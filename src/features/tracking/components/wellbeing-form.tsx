"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState } from "@/features/auth/form-state";
import { cn } from "@/lib/utils";
import { saveWellbeingAction } from "../actions";
import { MOOD_LABELS } from "../messages";
import { MOOD_ICONS } from "./mood-icons";

const QUICK_SLEEP = ["6", "7", "8"];

/** Sueño (horas) y ánimo (1 a 5). Los dos son opcionales. */
export function WellbeingForm({ date, sleepHours, mood }: { date: string; sleepHours: number | null; mood: number | null }) {
  const [state, formAction, pending] = useActionState(saveWellbeingAction, initialFormState);
  const [sleep, setSleep] = useState(sleepHours === null ? "" : String(sleepHours).replace(".", ","));
  const [selected, setSelected] = useState<number | null>(mood);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="mood" value={selected ?? ""} />
      <div className="grid gap-2">
        <Label htmlFor="sleepHours">Horas de sueño</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="sleepHours"
            name="sleepHours"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej.: 7,5"
            value={sleep}
            onChange={(e) => setSleep(e.target.value.replace(/[^\d,.]/g, "").slice(0, 4))}
            className="h-11 w-24 text-lg"
            aria-invalid={state.fieldErrors?.sleepHours ? true : undefined}
          />
          {QUICK_SLEEP.map((h) => (
            <Button key={h} type="button" variant="outline" size="sm" onClick={() => setSleep(h)}>
              {h} h
            </Button>
          ))}
        </div>
        {state.fieldErrors?.sleepHours ? <p className="text-destructive text-sm">{state.fieldErrors.sleepHours[0]}</p> : null}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">¿Cómo te sentiste?</legend>
        <div role="radiogroup" aria-label="Ánimo" className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((m) => {
            const Icon = MOOD_ICONS[m]!;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected === m}
                onClick={() => setSelected(selected === m ? null : m)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-[11px]",
                  selected === m ? "border-transparent bg-tile-rose text-tile-ink font-semibold" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                {MOOD_LABELS[m]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending || (sleep === "" && selected === null)}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
