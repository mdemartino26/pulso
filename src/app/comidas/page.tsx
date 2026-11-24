import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/calc";
import { MEAL_LABELS, describePortion } from "@/lib/food";
import { copyDayAction } from "@/features/food/actions";
import { ActionButton } from "@/features/food/components/action-form";
import { DaySummary } from "@/features/food/components/day-summary";
import { dayLabel, pickDate } from "@/features/food/dates";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { foodDeps } from "@/server/services/food-deps";
import { getDayLog } from "@/server/services/food-service";
import { profileDeps } from "@/server/services/profile-deps";

export const metadata: Metadata = { title: "Comidas" };

const kcal = (v: number) => `${Math.round(v).toLocaleString("es-AR")} kcal`;

export default async function FoodDayPage({ searchParams }: PageProps<"/comidas">) {
  const { user, overview } = await requireCompleteProfile();
  const { fecha } = await searchParams;
  const today = overview.today;
  const date = pickDate(fecha, today);

  const [log, storedTargets] = await Promise.all([
    getDayLog(await foodDeps(user.id), user.id, date),
    date === today ? Promise.resolve(null) : (await profileDeps()).targets.get(user.id, date),
  ]);
  const targets = storedTargets ?? overview.targets;
  const isEmpty = log.meals.every((m) => m.entries.length === 0);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ChevronLeft aria-hidden />
            Inicio
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/comidas/alimentos">Mis alimentos</Link>
        </Button>
      </header>

      <nav aria-label="Elegir día" className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" aria-label="Día anterior">
          <Link href={`/comidas?fecha=${prev}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold capitalize">{dayLabel(date, today)}</h1>
        {date < today ? (
          <Button asChild variant="ghost" size="icon" aria-label="Día siguiente">
            <Link href={`/comidas?fecha=${next}`}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <span className="size-9" aria-hidden />
        )}
      </nav>

      <DaySummary totals={log.totals} targets={targets} />

      {isEmpty && log.previousDayHasEntries ? (
        <ActionButton action={copyDayAction} fields={{ from: prev, to: date }} pendingLabel="Copiando…">
          Copiar lo del día anterior
        </ActionButton>
      ) : null}

      <div className="grid gap-3">
        {log.meals.map(({ meal, entries, totals }) => (
          <section key={meal} aria-labelledby={`meal-${meal}`} className="bg-card rounded-xl border">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
              <h2 id={`meal-${meal}`} className="font-medium">
                {MEAL_LABELS[meal]}
                {entries.length > 0 ? <span className="text-muted-foreground ml-2 text-sm font-normal">{kcal(totals.kcal)}</span> : null}
              </h2>
              <Button asChild variant="ghost" size="sm" aria-label={`Agregar a ${MEAL_LABELS[meal]}`}>
                <Link href={`/comidas/agregar?fecha=${date}&comida=${meal}`}>
                  <Plus aria-hidden />
                  Agregar
                </Link>
              </Button>
            </div>
            {entries.length > 0 ? (
              <ul className="divide-y border-t">
                {entries.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/comidas/entrada/${e.id}`}
                      className="hover:bg-accent/50 flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{e.name}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {describePortion(e.quantity, e.unit, e.basePerUnit, e.basis)}
                          {e.brand ? ` · ${e.brand}` : ""}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm">{kcal(e.kcal)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}
