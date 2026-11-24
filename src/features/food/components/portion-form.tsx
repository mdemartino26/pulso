"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState, type FormState } from "@/features/auth/form-state";
import { setFavoriteAction } from "@/features/food/actions";
import {
  MEALS,
  MEAL_LABELS,
  basePerUnit,
  nutrientsFor,
  unitsFor,
  type FoodView,
  type Meal,
  type ServingUnit,
} from "@/lib/food";
import { cn } from "@/lib/utils";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

interface PortionFormProps {
  food: FoodView;
  meal: Meal;
  action: Action;
  submitLabel: string;
  /** Campos ocultos (fecha y alimento al agregar; id al editar). */
  hidden: Record<string, string>;
  initial?: { quantity: number; unit: ServingUnit };
  /** false cuando el alimento original ya no existe (no se puede marcar favorito). */
  canFavorite?: boolean;
}

const nf = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 1 });

function unitLabel(unit: ServingUnit) {
  return unit === "serving" ? "porciones" : unit;
}

/** Elegir cuánto se comió. Muestra en vivo las calorías con la misma cuenta que la base. */
export function PortionForm({ food, meal, action, submitLabel, hidden, initial, canFavorite = true }: PortionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const units = unitsFor(food.basis, food.serving);
  const [unit, setUnit] = useState<ServingUnit>(initial?.unit ?? units[0]!);
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity).replace(".", ",") : unit === "serving" ? "1" : "100");
  const [selectedMeal, setSelectedMeal] = useState<Meal>(meal);
  const [favorite, setFavorite] = useState(food.favorite);
  const [favPending, startFav] = useTransition();

  const preview = useMemo(() => {
    const q = Number(quantity.replace(",", "."));
    const bpu = basePerUnit(unit, food.basis, food.serving);
    if (!(q > 0) || bpu === null) return null;
    return { amount: q * bpu, ...nutrientsFor(food.per100, q * bpu) };
  }, [quantity, unit, food]);

  const quick = unit === "serving" ? ["0,5", "1", "2"] : ["50", "100", "150", "200"];

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    startFav(async () => {
      const r = await setFavoriteAction(food.ref, next);
      if (!r.ok) setFavorite(!next);
    });
  }

  return (
    <form action={formAction} className="grid gap-5">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="meal" value={selectedMeal} />
      <input type="hidden" name="unit" value={unit} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-semibold">{food.name}</h2>
          <p className="text-muted-foreground text-sm">
            {food.brand ? `${food.brand} · ` : ""}
            {nf(food.per100.kcal)} kcal cada 100 {food.basis}
          </p>
        </div>
        {canFavorite ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={favorite}
            aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
            disabled={favPending}
            onClick={toggleFavorite}
          >
            <Star aria-hidden className={cn(favorite && "fill-primary text-primary")} />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="quantity">Cantidad</Label>
        <div className="flex gap-2">
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            autoComplete="off"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-11 w-28 text-lg"
            aria-invalid={state.fieldErrors?.quantity ? true : undefined}
          />
          <div role="radiogroup" aria-label="Unidad" className="bg-muted grid flex-1 auto-cols-fr grid-flow-col gap-1 rounded-lg p-1">
            {units.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                onClick={() => {
                  setUnit(u);
                  setQuantity(u === "serving" ? "1" : String(Math.round((basePerUnit(unit, food.basis, food.serving) ?? 1) * Number(quantity.replace(",", ".") || 0)) || 100));
                }}
                className={cn(
                  "truncate rounded-md px-2 text-sm font-medium",
                  unit === u ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {unitLabel(u)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {quick.map((q) => (
            <Button key={q} type="button" variant="outline" size="sm" onClick={() => setQuantity(q)}>
              {q}
            </Button>
          ))}
        </div>
        {food.serving ? (
          <p className="text-muted-foreground text-xs">
            1 porción = {food.serving.label ? `${food.serving.label} · ` : ""}
            {nf(food.serving.size)} {food.basis}
          </p>
        ) : null}
        {state.fieldErrors?.quantity ? <p className="text-destructive text-sm">{state.fieldErrors.quantity[0]}</p> : null}
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Comida</span>
        <div role="radiogroup" aria-label="Comida" className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selectedMeal === m}
              onClick={() => setSelectedMeal(m)}
              className={cn(
                "h-9 rounded-full border px-3 text-sm",
                selectedMeal === m ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground",
              )}
            >
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Nutrientes de la porción" className="bg-muted/60 grid grid-cols-4 gap-2 rounded-lg p-3 text-center">
        {[
          ["kcal", preview?.kcal],
          ["Prot.", preview?.protein],
          ["Carb.", preview?.carbs],
          ["Grasas", preview?.fat],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-base font-semibold">{value != null ? nf(value as number) : "–"}</p>
            <p className="text-muted-foreground text-xs">
              {label}
              {label !== "kcal" ? " (g)" : ""}
            </p>
          </div>
        ))}
      </section>

      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending || !preview}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
