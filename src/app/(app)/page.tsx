import Link from "next/link";
import { Activity, ArrowUpRight, Droplet, HeartPulse, ListChecks, Moon, Plus, Scale, UserRound, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tile, TileNote, TileValue, tileButton } from "@/components/tile";
import { daysBetween } from "@/lib/calc";
import { HabitCheck } from "@/features/tracking/components/habit-check";
import { WaterButtons } from "@/features/tracking/components/water-buttons";
import { TrendSparkline } from "@/features/tracking/components/weight-chart";
import { MOOD_ICONS } from "@/features/tracking/components/mood-icons";
import { MOOD_LABELS } from "@/features/tracking/messages";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { activityDeps } from "@/server/services/activity-deps";
import { getActivityDay } from "@/server/services/activity-service";
import { foodDeps } from "@/server/services/food-deps";
import { getDayLog } from "@/server/services/food-service";
import { trackingDeps } from "@/server/services/tracking-deps";
import { getTrackingDay, getWeightHistory } from "@/server/services/tracking-service";

const n = (v: number, digits = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: digits });

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Panel del día: todo lo importante de hoy en tarjetas, con acciones de un toque. */
export default async function HomePage() {
  const { user, overview } = await requireCompleteProfile();
  const { targets, today } = overview;
  const [log, activity, tracking, weight] = await Promise.all([
    foodDeps(user.id).then((d) => getDayLog(d, user.id, today)),
    activityDeps(user.id).then((d) => getActivityDay(d, user.id, today)),
    trackingDeps(user.id).then((d) => getTrackingDay(d, user.id, today)),
    trackingDeps(user.id).then((d) => getWeightHistory(d, user.id, 30)),
  ]);

  const kcal = Math.round(log.totals.kcal);
  const left = targets ? targets.kcalTarget - kcal : null;
  const kcalPct = targets ? Math.min(100, (kcal / targets.kcalTarget) * 100) : 0;
  const waterGoal = targets?.waterMl ?? null;
  const waterPct = waterGoal ? Math.min(100, (tracking.waterMl / waterGoal) * 100) : 0;
  const daysSinceWeight = weight.latest ? daysBetween(weight.latest.date, today) : null;
  const mood = tracking.wellbeing?.mood ?? null;
  const MoodIcon = mood ? MOOD_ICONS[mood] : null;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 md:px-2 md:pt-2">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Hoy</h1>
          <p className="text-muted-foreground text-sm first-letter:uppercase">{longDate(today)}</p>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon" aria-label="Perfil">
            <Link href="/perfil">
              <UserRound aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile color="sun" label="Calorías" icon={ArrowUpRight} href="/comidas" hrefLabel="Ver comidas de hoy" className="col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <TileValue value={n(kcal)} unit="kcal" icon={Utensils} />
            {targets && left !== null ? (
              <div className="text-right">
                <TileNote>de {n(targets.kcalTarget)} kcal</TileNote>
                <TileNote strong>{left >= 0 ? `Te quedan ${n(left)}` : `${n(-left)} por encima. Mañana seguimos.`}</TileNote>
              </div>
            ) : null}
          </div>
          {targets ? (
            <div
              role="progressbar"
              aria-label="Calorías del día"
              aria-valuemin={0}
              aria-valuemax={targets.kcalTarget}
              aria-valuenow={kcal}
              className="h-2.5 overflow-hidden rounded-full bg-white/50"
            >
              <div className="bg-tile-ink h-full rounded-full" style={{ width: `${kcalPct}%` }} />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TileNote>
              Proteína <strong className="text-tile-ink">{n(log.totals.protein)} g</strong>
              {targets ? ` de ${targets.proteinMinG}–${targets.proteinMaxG} g` : ""}
            </TileNote>
            <Link href="/comidas/agregar" className={tileButton}>
              <Plus aria-hidden className="size-4" />
              Comida
            </Link>
          </div>
        </Tile>

        <Tile color="peach" label="Actividad" icon={ArrowUpRight} href="/actividad" hrefLabel="Ver actividad de hoy">
          <TileValue value={n(activity.minutes)} unit="min" icon={Activity} />
          <TileNote>
            {activity.exerciseKcal > 0 ? `${n(activity.exerciseKcal)} kcal de ejercicio` : "Moverse un poco ya suma"}
            {activity.steps ? ` · ${n(activity.steps)} pasos` : ""}
          </TileNote>
          <Link href="/actividad/agregar" className={`${tileButton} mt-auto self-start`}>
            <Plus aria-hidden className="size-4" />
            Actividad
          </Link>
        </Tile>

        <Tile color="sky" label="Agua" icon={Droplet}>
          <TileValue value={n(tracking.waterMl / 1000, 2)} unit="L" />
          <TileNote>{waterGoal ? `de ${n(waterGoal / 1000, 2)} L` : "Sin meta todavía"}</TileNote>
          {waterGoal ? (
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-white/50">
              <div className="bg-tile-ink h-full rounded-full" style={{ width: `${waterPct}%` }} />
            </div>
          ) : null}
          <div className="mt-auto">
            <WaterButtons date={today} canUndo={tracking.waterMl > 0} />
          </div>
        </Tile>

        <Tile color="lilac" label="Peso" icon={ArrowUpRight} href="/peso" hrefLabel="Ver y registrar peso">
          {weight.latest ? (
            <>
              <TileValue value={n(weight.latest.trend, 1)} unit="kg" icon={Scale} />
              <TileNote>
                Tendencia de 7 días
                {weight.weeklyChange !== null
                  ? ` · ${weight.weeklyChange === 0 ? "estable" : `${weight.weeklyChange > 0 ? "+" : "−"}${n(Math.abs(weight.weeklyChange), 1)} kg en la semana`}`
                  : ""}
              </TileNote>
              {weight.points.length >= 3 ? <TrendSparkline values={weight.points.map((p) => p.trend)} /> : null}
              {daysSinceWeight !== null && daysSinceWeight >= 7 ? (
                <TileNote strong>Hace {daysSinceWeight} días que no registrás tu peso.</TileNote>
              ) : null}
            </>
          ) : (
            <TileNote>Registrá tu peso para ver la tendencia.</TileNote>
          )}
        </Tile>

        <Tile color="rose" label="Sueño y ánimo" icon={ArrowUpRight} href="/bienestar" hrefLabel="Cargar sueño y ánimo">
          <TileValue
            value={tracking.wellbeing?.sleepHours != null ? n(tracking.wellbeing.sleepHours, 1) : "–"}
            unit="h"
            icon={Moon}
          />
          {mood && MoodIcon ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <MoodIcon aria-hidden className="size-5" strokeWidth={1.75} />
              {MOOD_LABELS[mood]}
            </p>
          ) : (
            <TileNote>¿Cómo dormiste y cómo te sentís?</TileNote>
          )}
          {!tracking.wellbeing ? (
            <Link href="/bienestar" className={`${tileButton} mt-auto self-start`}>
              <HeartPulse aria-hidden className="size-4" />
              Cargar
            </Link>
          ) : null}
        </Tile>

        <Tile color="lime" label="Hábitos" icon={ArrowUpRight} href="/habitos" hrefLabel="Editar hábitos" className="col-span-2">
          {tracking.habits.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {tracking.habits.slice(0, 8).map((h) => (
                <HabitCheck
                  key={h.id}
                  habitId={h.id}
                  name={h.name}
                  date={today}
                  doneToday={h.doneToday}
                  done={h.done}
                  window={h.window}
                  days={h.days}
                />
              ))}
            </div>
          ) : (
            <>
              <TileValue value="0" icon={ListChecks} />
              <TileNote>Sumá hábitos chicos y fáciles de cumplir. Contamos cuántos días de la semana los hiciste, sin rachas que se rompen.</TileNote>
              <Link href="/habitos" className={`${tileButton} self-start`}>
                <Plus aria-hidden className="size-4" />
                Crear hábito
              </Link>
            </>
          )}
        </Tile>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Lo que importa es la tendencia de varias semanas, no un día suelto.
      </p>
    </main>
  );
}
