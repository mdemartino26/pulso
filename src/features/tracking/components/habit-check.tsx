"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { initialFormState } from "@/features/auth/form-state";
import { cn } from "@/lib/utils";
import { toggleHabitAction } from "../actions";

interface HabitCheckProps {
  habitId: string;
  name: string;
  date: string;
  doneToday: boolean;
  done: number;
  window: number;
  days: { date: string; done: boolean }[];
}

/** Marcar un hábito del día. Se ve marcado al instante (optimista). */
export function HabitCheck({ habitId, name, date, doneToday, done, window, days }: HabitCheckProps) {
  const [state, formAction] = useActionState(toggleHabitAction, initialFormState);
  const [optimistic, setOptimistic] = useOptimistic(doneToday);
  const [, startTransition] = useTransition();
  const count = done + (optimistic === doneToday ? 0 : optimistic ? 1 : -1);

  return (
    <form
      action={(fd) => {
        startTransition(() => {
          setOptimistic(!optimistic);
          formAction(fd);
        });
      }}
      className="flex items-center gap-3"
    >
      <input type="hidden" name="habitId" value={habitId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="done" value={String(!optimistic)} />
      <button
        type="submit"
        role="checkbox"
        aria-checked={optimistic}
        aria-label={name}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-xl border-2 border-current/40 transition-colors",
          optimistic && "border-transparent bg-white/70",
        )}
      >
        {optimistic ? <Check aria-hidden className="size-4.5" strokeWidth={3} /> : null}
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="flex items-center gap-1.5">
          <span className="flex gap-0.5" aria-hidden>
            {days.map((d, i) => {
              const on = i === days.length - 1 ? optimistic : d.done;
              return <span key={d.date} className={cn("size-1.5 rounded-full", on ? "bg-current" : "bg-current/25")} />;
            })}
          </span>
          <span className="text-tile-ink-soft text-xs">
            {count} de los últimos {window} días
          </span>
        </span>
      </span>
      {state.status === "error" ? <span className="sr-only" role="alert">{state.message}</span> : null}
    </form>
  );
}
