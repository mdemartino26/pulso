"use client";

import { useActionState, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState, type FormState } from "@/features/auth/form-state";
import { customFoodSchema } from "@/lib/validation/food";
import { cn } from "@/lib/utils";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export interface CustomFoodValues {
  name: string;
  brand: string;
  basis: "g" | "ml";
  kcal100: string;
  protein100: string;
  carbs100: string;
  fat100: string;
  fiber100: string;
  sugars100: string;
  sodiumMg100: string;
  servingSize: string;
  servingLabel: string;
}

export const EMPTY_CUSTOM_FOOD: CustomFoodValues = {
  name: "",
  brand: "",
  basis: "g",
  kcal100: "",
  protein100: "",
  carbs100: "",
  fat100: "",
  fiber100: "",
  sugars100: "",
  sodiumMg100: "",
  servingSize: "",
  servingLabel: "",
};

export function CustomFoodForm({
  action,
  defaults,
  hidden,
  submitLabel,
}: {
  action: Action;
  defaults: CustomFoodValues;
  hidden: Record<string, string>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [basis, setBasis] = useState(defaults.basis);
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined>>();
  const errors = clientErrors ?? state.fieldErrors;
  const unit = basis;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const parsed = customFoodSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      e.preventDefault();
      setClientErrors(z.flattenError(parsed.error).fieldErrors);
    } else setClientErrors(undefined);
  }

  const field = (name: keyof CustomFoodValues, label: string, opts: { decimal?: boolean; placeholder?: string } = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaults[name]}
        inputMode={opts.decimal ? "decimal" : undefined}
        autoComplete="off"
        placeholder={opts.placeholder}
        aria-invalid={errors?.[name] ? true : undefined}
      />
      {errors?.[name] ? <p className="text-destructive text-sm">{errors[name][0]}</p> : null}
    </div>
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-5">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="basis" value={basis} />
      {field("name", "Nombre", { placeholder: "Tarta de zapallitos" })}
      {field("brand", "Marca (opcional)")}

      <div className="grid gap-2">
        <span className="text-sm font-medium">Los valores son cada…</span>
        <div role="radiogroup" aria-label="Base" className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
          {(["g", "ml"] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={basis === b}
              onClick={() => setBasis(b)}
              className={cn("h-9 rounded-md text-sm font-medium", basis === b ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              100 {b}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Copialos de la tabla nutricional del envase.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field("kcal100", "Calorías (kcal)", { decimal: true })}
        {field("protein100", "Proteínas (g)", { decimal: true })}
        {field("carbs100", "Carbohidratos (g)", { decimal: true })}
        {field("fat100", "Grasas (g)", { decimal: true })}
        {field("fiber100", "Fibra (g, opcional)", { decimal: true })}
        {field("sugars100", "Azúcares (g, opcional)", { decimal: true })}
        {field("sodiumMg100", "Sodio (mg, opcional)", { decimal: true })}
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Porción (opcional)</legend>
        <div className="grid grid-cols-2 gap-4">
          {field("servingLabel", "Nombre", { placeholder: "1 porción" })}
          {field("servingSize", `Cuánto pesa (${unit})`, { decimal: true, placeholder: "150" })}
        </div>
      </fieldset>

      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
