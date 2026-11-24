import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends ComponentProps<typeof Input> {
  name: string;
  label: string;
  errors?: string[] | undefined;
  hint?: string;
}

/** Campo con label, error accesible (aria-describedby) y ayuda opcional. */
export function FormField({ name, label, errors, hint, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [errors?.length ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && !errors?.length ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-destructive text-sm">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
