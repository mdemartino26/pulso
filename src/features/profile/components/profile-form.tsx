"use client";

import { useActionState, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState, type FormState } from "@/features/auth/form-state";
import { FormMessage } from "@/features/auth/components/form-message";
import {
  WEEKLY_RATE_OPTIONS,
  computeDailyTargets,
  type ActivityLevel,
  type Goal,
  type IsoDate,
  type Sex,
} from "@/lib/calc";
import { cn } from "@/lib/utils";
import { goalSafety, makeProfileSchema, safetyMessage } from "@/lib/validation/profile";

export interface ProfileFormValues {
  sex: Sex | "";
  birthDate: string;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel | "";
  timezone: string;
  goal: Goal | "";
  weeklyRateKg: string;
  waterGoalOverrideMl: string;
}

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

interface ProfileFormProps {
  mode: "onboarding" | "edit";
  today: IsoDate;
  defaults: ProfileFormValues;
  action: Action;
  timezones: string[];
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: "sedentary", label: "Sedentario", hint: "Trabajo sentado, me muevo poco." },
  { value: "light", label: "Ligero", hint: "Camino un poco todos los días." },
  { value: "moderate", label: "Moderado", hint: "Estoy bastante en movimiento." },
  { value: "high", label: "Alto", hint: "Trabajo físico o muy activo todo el día." },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "lose", label: "Bajar" },
  { value: "maintain", label: "Mantener" },
  { value: "gain", label: "Subir" },
];

const noopSubscribe = () => () => {};

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function ProfileForm({ mode, today, defaults, action, timezones }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [values, setValues] = useState(defaults);
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined>>();
  const schema = useMemo(
    () => makeProfileSchema({ today, requireHealthAck: mode === "onboarding" }),
    [today, mode],
  );

  // En el onboarding proponemos la zona horaria del dispositivo, hasta que
  // la persona elija otra. Los navegadores pueden devolver alias (p. ej.
  // America/Buenos_Aires): lo sumamos a la lista; el servidor lo valida igual.
  const detectedTz = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    () => null,
  );
  const [tzTouched, setTzTouched] = useState(mode === "edit");
  const timezone = !tzTouched && detectedTz ? detectedTz : values.timezone;
  const tzOptions = timezones.includes(timezone) ? timezones : [timezone, ...timezones];

  const errors = clientErrors ?? state.fieldErrors;
  // Al corregir un campo, su mensaje de error desaparece.
  const clearError = (key: string) => {
    if (errors?.[key]) setClientErrors({ ...errors, [key]: undefined });
  };
  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    clearError(key);
    if (key === "goal" || key === "sex" || key === "weightKg") clearError("weeklyRateKg");
  };

  const preview = usePreview(values, today);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setClientErrors(undefined);
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-8">
      <Section title="Sobre vos" hint="Lo usamos solo para estimar tu gasto de energía.">
        <Field label="Sexo biológico" error={errors?.sex} hint="La fórmula usa valores distintos según el sexo biológico.">
          <Choice
            name="sex"
            value={values.sex}
            onChange={(v) => set("sex", v as Sex)}
            options={[
              { value: "female", label: "Femenino" },
              { value: "male", label: "Masculino" },
            ]}
          />
        </Field>
        <Field label="Fecha de nacimiento" htmlFor="birthDate" error={errors?.birthDate}>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            max={today}
            value={values.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
            aria-invalid={errors?.birthDate ? true : undefined}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Altura (cm)" htmlFor="heightCm" error={errors?.heightCm}>
            <Input
              id="heightCm"
              name="heightCm"
              inputMode="decimal"
              autoComplete="off"
              placeholder="165"
              value={values.heightCm}
              onChange={(e) => set("heightCm", e.target.value)}
              aria-invalid={errors?.heightCm ? true : undefined}
            />
          </Field>
          <Field label="Peso actual (kg)" htmlFor="weightKg" error={errors?.weightKg}>
            <Input
              id="weightKg"
              name="weightKg"
              inputMode="decimal"
              autoComplete="off"
              placeholder="70,5"
              value={values.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
              aria-invalid={errors?.weightKg ? true : undefined}
            />
          </Field>
        </div>
      </Section>

      <Section title="Tu día a día" hint="Sin contar el ejercicio: eso lo vas a registrar aparte.">
        <Field label="Nivel de actividad" error={errors?.activityLevel}>
          <div role="radiogroup" aria-label="Nivel de actividad" className="grid gap-2">
            {ACTIVITY_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                name="activityLevel"
                value={o.value}
                checked={values.activityLevel === o.value}
                onChange={() => set("activityLevel", o.value)}
                label={o.label}
                hint={o.hint}
              />
            ))}
          </div>
        </Field>
        <Field label="Zona horaria" htmlFor="timezone" error={errors?.timezone} hint="Define a qué día pertenece cada registro.">
          <select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={(e) => {
              setTzTouched(true);
              set("timezone", e.target.value);
            }}
            className="border-input dark:bg-input/30 h-11 w-full rounded-md border bg-transparent px-3 text-base shadow-xs"
          >
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Tu objetivo">
        <Field label="Quiero…" error={errors?.goal}>
          <Choice
            name="goal"
            value={values.goal}
            onChange={(v) => set("goal", v as Goal)}
            options={GOAL_OPTIONS}
          />
        </Field>
        {values.goal === "lose" || values.goal === "gain" ? (
          <Field label="Ritmo por semana" error={preview.safety && !preview.safety.ok ? undefined : errors?.weeklyRateKg}>
            <Choice
              name="weeklyRateKg"
              value={values.weeklyRateKg}
              onChange={(v) => set("weeklyRateKg", v)}
              options={WEEKLY_RATE_OPTIONS.filter((r) => values.goal === "lose" || r <= 0.5).map((r) => ({
                value: String(r),
                label: `${values.goal === "lose" ? "−" : "+"}${fmt(r)} kg`,
              }))}
            />
          </Field>
        ) : (
          <input type="hidden" name="weeklyRateKg" value="0" />
        )}

        {preview.safety && !preview.safety.ok && values.goal !== "maintain" && values.goal !== "" ? (
          <div role="status" className="bg-accent text-accent-foreground grid gap-3 rounded-lg p-4 text-sm">
            <p className="font-medium">Un ritmo más amable te va a rendir más</p>
            <p>
              {safetyMessage(preview.safety.issues[0] ?? "rate_above_max", values.goal, preview.safety.suggestedRateKg)}
            </p>
            {preview.safety.suggestedRateKg != null ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="justify-self-start"
                onClick={() => set("weeklyRateKg", String(preview.safety?.suggestedRateKg))}
              >
                Usar {fmt(preview.safety.suggestedRateKg)} kg por semana
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" className="justify-self-start" onClick={() => set("goal", "maintain")}>
                Empezar manteniendo
              </Button>
            )}
          </div>
        ) : null}
      </Section>

      {mode === "edit" ? (
        <Section title="Agua">
          <Field
            label="Meta de agua manual (ml)"
            htmlFor="waterGoalOverrideMl"
            error={errors?.waterGoalOverrideMl}
            hint="Dejalo vacío para usar la calculada (35 ml por kg, +500 ml los días con ejercicio)."
          >
            <Input
              id="waterGoalOverrideMl"
              name="waterGoalOverrideMl"
              inputMode="numeric"
              placeholder={preview.targets ? String(preview.targets.waterMl) : "2000"}
              value={values.waterGoalOverrideMl}
              onChange={(e) => set("waterGoalOverrideMl", e.target.value)}
            />
          </Field>
        </Section>
      ) : null}

      {preview.targets ? <TargetsPreview targets={preview.targets} /> : null}

      {mode === "onboarding" ? (
        <div className="grid gap-2">
          <div className="bg-muted text-muted-foreground grid gap-2 rounded-lg p-4 text-sm">
            <p className="text-foreground font-medium">Antes de empezar</p>
            <p>
              Pulso te da estimaciones generales y no reemplaza la consulta con un profesional de la
              salud. Si estás embarazada o en lactancia, tenés o tuviste un trastorno de la conducta
              alimentaria, o tenés alguna condición médica, consultá con tu médico o nutricionista
              antes de buscar un déficit calórico.
            </p>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="healthAck"
              onChange={() => clearError("healthAck")}
              className="accent-primary mt-0.5 size-5 shrink-0"
              aria-invalid={errors?.healthAck ? true : undefined}
            />
            <span>Leí el aviso y entiendo que Pulso no reemplaza a un profesional.</span>
          </label>
          {errors?.healthAck ? <p className="text-destructive text-sm">{errors.healthAck[0]}</p> : null}
        </div>
      ) : null}

      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : mode === "onboarding" ? "Empezar" : "Guardar cambios"}
      </Button>
    </form>
  );
}

/** Calcula en vivo (con las mismas funciones que el servidor) mientras se completa el formulario. */
function usePreview(values: ProfileFormValues, today: IsoDate) {
  return useMemo(() => {
    const heightCm = Number(values.heightCm.replace(",", "."));
    const weightKg = Number(values.weightKg.replace(",", "."));
    const weeklyRateKg = values.goal === "maintain" ? 0 : Number(values.weeklyRateKg);
    if (
      !values.sex ||
      !values.activityLevel ||
      !values.goal ||
      !/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate) ||
      values.birthDate > today ||
      !(heightCm >= 100 && heightCm <= 250) ||
      !(weightKg >= 30 && weightKg <= 300) ||
      (values.goal !== "maintain" && !weeklyRateKg)
    ) {
      return { targets: null, safety: null };
    }
    const data = {
      sex: values.sex,
      birthDate: values.birthDate,
      heightCm,
      weightKg,
      activityLevel: values.activityLevel,
      goal: values.goal,
      weeklyRateKg,
    };
    try {
      const safety = goalSafety(data, today);
      const override = Number(values.waterGoalOverrideMl);
      const targets = safety.ok
        ? computeDailyTargets(
            { ...data, waterGoalOverrideMl: override >= 500 && override <= 6000 ? override : null },
            weightKg,
            today,
          )
        : null;
      return { targets, safety };
    } catch {
      return { targets: null, safety: null };
    }
  }, [values, today]);
}

function TargetsPreview({ targets }: { targets: NonNullable<ReturnType<typeof usePreview>["targets"]> }) {
  const n = (v: number) => v.toLocaleString("es-AR");
  return (
    <section aria-label="Tus metas estimadas" className="bg-card grid gap-3 rounded-xl border p-4">
      <p className="text-muted-foreground text-sm">Tu meta para un día sin ejercicio</p>
      <p className="text-3xl font-semibold tracking-tight">
        {n(targets.kcalTarget)} <span className="text-muted-foreground text-base font-normal">kcal</span>
      </p>
      <dl className="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt>Gasto estimado</dt>
          <dd className="text-foreground text-sm font-medium">{n(targets.tdeeKcal)} kcal</dd>
        </div>
        <div>
          <dt>Proteína</dt>
          <dd className="text-foreground text-sm font-medium">
            {targets.proteinMinG}–{targets.proteinMaxG} g
          </dd>
        </div>
        <div>
          <dt>Agua</dt>
          <dd className="text-foreground text-sm font-medium">{fmt(targets.waterMl / 1000)} L</dd>
        </div>
      </dl>
      <p className="text-muted-foreground text-xs">
        Los días que registres ejercicio o muchos pasos, la meta sube sola.
      </p>
    </section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1">
        <span className="text-lg font-semibold">{title}</span>
        {hint ? <span className="text-muted-foreground block text-sm">{hint}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string[] | undefined;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label> : <span className="text-sm font-medium">{label}</span>}
      {children}
      {hint && !error?.length ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error?.length ? <p className="text-destructive text-sm">{error[0]}</p> : null}
    </div>
  );
}

/** Botones segmentados accesibles (radios nativos con otro estilo). */
function Choice({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div role="radiogroup" className="bg-muted grid auto-cols-fr grid-flow-col gap-1 rounded-lg p-1">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex h-10 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function OptionCard({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
        checked ? "border-primary bg-primary/5" : "hover:bg-accent/50",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="accent-primary mt-1 size-4" />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
    </label>
  );
}
