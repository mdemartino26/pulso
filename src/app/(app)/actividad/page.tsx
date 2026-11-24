import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/calc";
import { INTENSITY_LABELS } from "@/features/activity/labels";
import { StepsForm } from "@/features/activity/components/steps-form";
import { dayLabel, pickDate } from "@/features/food/dates";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { activityDeps } from "@/server/services/activity-deps";
import { getActivityDay } from "@/server/services/activity-service";

export const metadata: Metadata = { title: "Actividad" };

const n = (v: number) => v.toLocaleString("es-AR");

export default async function ActivityDayPage({ searchParams }: PageProps<"/actividad">) {
  const { user, overview } = await requireCompleteProfile();
  const { fecha } = await searchParams;
  const today = overview.today;
  const date = pickDate(fecha, today);
  const day = await getActivityDay(await activityDeps(user.id), user.id, date);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">Actividad</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/actividad/fuerza">
            <Dumbbell aria-hidden />
            Mi progreso
          </Link>
        </Button>
      </header>

      <nav aria-label="Elegir día" className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" aria-label="Día anterior">
          <Link href={`/actividad?fecha=${prev}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold capitalize">{dayLabel(date, today)}</h1>
        {date < today ? (
          <Button asChild variant="ghost" size="icon" aria-label="Día siguiente">
            <Link href={`/actividad?fecha=${next}`}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <span className="size-9" aria-hidden />
        )}
      </nav>

      <section aria-label="Resumen de actividad" className="bg-tile-peach text-tile-ink grid grid-cols-3 gap-2 rounded-[1.75rem] p-4 text-center shadow-sm">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{n(day.exerciseKcal)}</p>
          <p className="text-tile-ink-soft text-xs">kcal de ejercicio</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{n(day.minutes)}</p>
          <p className="text-tile-ink-soft text-xs">minutos</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{day.steps === null ? "–" : n(day.steps)}</p>
          <p className="text-tile-ink-soft text-xs">pasos</p>
        </div>
      </section>

      <Button asChild size="lg">
        <Link href={`/actividad/agregar?fecha=${date}`}>
          <Plus aria-hidden />
          Agregar actividad
        </Link>
      </Button>

      {day.entries.length > 0 ? (
        <ul aria-label="Actividades del día" className="bg-card divide-y overflow-hidden rounded-3xl border backdrop-blur-xl">
          {day.entries.map((e) => (
            <li key={e.id}>
              <Link href={`/actividad/entrada/${e.id}`} className="hover:bg-accent/50 flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{e.activity?.name ?? "Actividad"}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {e.durationMin} min · {INTENSITY_LABELS[e.intensity].label}
                    {e.sets.length > 0 ? ` · ${e.sets.length} ${e.sets.length === 1 ? "serie" : "series"}` : ""}
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-sm">{n(e.kcal)} kcal</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          {date === today ? "Todavía no registraste actividad hoy. Moverse un poco ya suma." : "No hay actividad registrada este día."}
        </p>
      )}

      <section className="bg-card grid gap-2 rounded-3xl border backdrop-blur-xl p-4">
        <StepsForm key={date} date={date} steps={day.steps} />
        <p className="text-muted-foreground text-xs">
          Solo suman los pasos por encima de lo habitual para tu nivel de actividad, y no contamos dos veces los de
          caminatas o carreras que registres.
        </p>
      </section>
    </main>
  );
}
