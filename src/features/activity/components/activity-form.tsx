"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState, type FormState } from "@/features/auth/form-state";
import { STRENGTH_ACTIVITY_SLUGS, exerciseKcal, metFor, type Intensity } from "@/lib/calc";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, INTENSITY_LABELS } from "../labels";
import type { ActivityCategory, Exercise, MetActivity } from "@/server/repositories/activity-types";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const CATEGORIES: ActivityCategory[] = ["gym", "cardio", "sport", "daily"];

const INTENSITIES: Intensity[] = ["low", "moderate", "high"];
const QUICK_MINUTES = [15, 30, 45, 60, 90];

interface SetRow {
  key: number;
  exerciseId: string;
  reps: string;
  weightKg: string;
}

interface ActivityFormProps {
  activities: MetActivity[];
  exercises: Exercise[];
  /** Solo para la vista previa: el servidor vuelve a calcular con su dato. */
  weightKg: number | null;
  action: Action;
  submitLabel: string;
  hidden: Record<string, string>;
  initial?: {
    metActivityId: number;
    intensity: Intensity;
    durationMin: number;
    sets: { exerciseId: number; reps: number; weightKg: number }[];
  };
}

let nextKey = 1;
const toRow = (s: { exerciseId: number | string; reps: number | string; weightKg: number | string }): SetRow => ({
  key: nextKey++,
  exerciseId: String(s.exerciseId),
  reps: String(s.reps),
  weightKg: String(s.weightKg).replace(".", ","),
});

/** Registrar una actividad: qué, cuánto tiempo, qué tan fuerte y (en pesas) las series. */
export function ActivityForm({ activities, exercises, weightKg, action, submitLabel, hidden, initial }: ActivityFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const initialActivity = activities.find((a) => a.id === initial?.metActivityId);
  const [category, setCategory] = useState<ActivityCategory>(initialActivity?.category ?? "gym");
  const [activityId, setActivityId] = useState<number | null>(initialActivity?.id ?? null);
  const [intensity, setIntensity] = useState<Intensity>(initial?.intensity ?? "moderate");
  const [minutes, setMinutes] = useState(initial ? String(initial.durationMin) : "45");
  const [sets, setSets] = useState<SetRow[]>(() => (initial?.sets ?? []).map(toRow));

  const activity = activities.find((a) => a.id === activityId) ?? null;
  const isStrength = activity ? STRENGTH_ACTIVITY_SLUGS.includes(activity.slug) : false;

  const preview = useMemo(() => {
    const min = Number(minutes);
    if (!activity || !weightKg || !(min >= 1 && min <= 600)) return null;
    const met = metFor(activity, intensity);
    return { met, kcal: exerciseKcal({ met, weightKg, durationMin: min }) };
  }, [activity, intensity, minutes, weightKg]);

  const groups = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of exercises) map.set(e.muscleGroup, [...(map.get(e.muscleGroup) ?? []), e]);
    return [...map.entries()];
  }, [exercises]);

  const setsJson = isStrength
    ? JSON.stringify(sets.map((s) => ({ exerciseId: s.exerciseId, reps: s.reps, weightKg: s.weightKg })))
    : "";

  function addSet() {
    const last = sets.at(-1);
    setSets([...sets, toRow(last ?? { exerciseId: exercises[0]?.id ?? "", reps: "10", weightKg: "0" })]);
  }
  const updateSet = (key: number, patch: Partial<SetRow>) =>
    setSets(sets.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <form action={formAction} className="grid gap-6">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="metActivityId" value={activityId ?? ""} />
      <input type="hidden" name="intensity" value={intensity} />
      <input type="hidden" name="sets" value={setsJson} />

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">¿Qué hiciste?</legend>
        <div role="tablist" aria-label="Tipo de actividad" className="bg-muted grid grid-cols-4 gap-1 rounded-lg p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "truncate rounded-md px-1 py-1.5 text-xs font-medium",
                category === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Actividad" className="flex flex-wrap gap-2">
          {activities
            .filter((a) => a.category === category)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={activityId === a.id}
                onClick={() => setActivityId(a.id)}
                className={cn(
                  "min-h-9 rounded-full border px-3 py-1 text-sm",
                  activityId === a.id ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground",
                )}
              >
                {a.name}
              </button>
            ))}
        </div>
        {state.fieldErrors?.metActivityId ? (
          <p className="text-destructive text-sm">{state.fieldErrors.metActivityId[0]}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="durationMin">Duración (minutos)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="durationMin"
            name="durationMin"
            inputMode="numeric"
            autoComplete="off"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-11 w-20 text-lg"
            aria-invalid={state.fieldErrors?.durationMin ? true : undefined}
          />
          {QUICK_MINUTES.map((m) => (
            <Button key={m} type="button" variant="outline" size="sm" onClick={() => setMinutes(String(m))}>
              {m}
            </Button>
          ))}
        </div>
        {state.fieldErrors?.durationMin ? <p className="text-destructive text-sm">{state.fieldErrors.durationMin[0]}</p> : null}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Intensidad</legend>
        <div role="radiogroup" aria-label="Intensidad" className="grid grid-cols-3 gap-2">
          {INTENSITIES.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={intensity === i}
              onClick={() => setIntensity(i)}
              className={cn(
                "rounded-lg border px-2 py-2 text-left",
                intensity === i ? "border-primary bg-primary/10" : "text-muted-foreground",
              )}
            >
              <span className="block text-sm font-medium">{INTENSITY_LABELS[i].label}</span>
              <span className="block text-xs leading-tight opacity-80">{INTENSITY_LABELS[i].hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {isStrength ? (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">Series (opcional)</legend>
          <p className="text-muted-foreground -mt-1 text-xs">Sirven para ver tu progreso. Usá 0 kg para peso corporal.</p>
          {sets.length > 0 ? (
            <ol className="grid gap-2">
              {sets.map((s, i) => (
                <li key={s.key} className="bg-muted/50 grid grid-cols-[1fr_auto] gap-2 rounded-lg p-2">
                  <select
                    aria-label={`Ejercicio de la serie ${i + 1}`}
                    value={s.exerciseId}
                    onChange={(e) => updateSet(s.key, { exerciseId: e.target.value })}
                    className="bg-background h-9 min-w-0 rounded-md border px-2 text-sm"
                  >
                    {groups.map(([group, list]) => (
                      <optgroup key={group} label={group}>
                        {list.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar serie ${i + 1}`}
                    onClick={() => setSets(sets.filter((x) => x.key !== s.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                  <div className="col-span-2 flex items-center gap-2 text-sm">
                    <Input
                      aria-label={`Repeticiones de la serie ${i + 1}`}
                      inputMode="numeric"
                      value={s.reps}
                      onChange={(e) => updateSet(s.key, { reps: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                      className="h-9 w-16"
                    />
                    <span className="text-muted-foreground">reps ×</span>
                    <Input
                      aria-label={`Peso de la serie ${i + 1} en kg`}
                      inputMode="decimal"
                      value={s.weightKg}
                      onChange={(e) => updateSet(s.key, { weightKg: e.target.value.replace(/[^\d,.]/g, "").slice(0, 6) })}
                      className="h-9 w-20"
                    />
                    <span className="text-muted-foreground">kg</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          <Button type="button" variant="outline" onClick={addSet} disabled={sets.length >= 50}>
            <Plus aria-hidden />
            {sets.length === 0 ? "Agregar serie" : "Repetir serie"}
          </Button>
          {state.fieldErrors?.sets ? <p className="text-destructive text-sm">{state.fieldErrors.sets[0]}</p> : null}
        </fieldset>
      ) : null}

      <section aria-live="polite" className="bg-muted/60 rounded-lg p-3 text-center">
        {preview ? (
          <>
            <p className="text-2xl font-semibold">≈ {preview.kcal.toLocaleString("es-AR")} kcal</p>
            <p className="text-muted-foreground text-xs">
              extra sobre tu gasto en reposo · MET {preview.met.toLocaleString("es-AR")}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Elegí una actividad para ver la estimación.</p>
        )}
      </section>

      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending || !activity}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
