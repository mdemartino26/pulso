import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, pageMain, panel } from "@/components/page-header";
import { MOOD_ICONS } from "@/features/tracking/components/mood-icons";
import { WellbeingForm } from "@/features/tracking/components/wellbeing-form";
import { MOOD_LABELS } from "@/features/tracking/messages";
import { dayLabel, pickDate } from "@/features/food/dates";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { trackingDeps } from "@/server/services/tracking-deps";
import { getTrackingDay, getWellbeingHistory } from "@/server/services/tracking-service";

export const metadata: Metadata = { title: "Sueño y ánimo" };

export default async function WellbeingPage({ searchParams }: PageProps<"/bienestar">) {
  const { user, overview } = await requireCompleteProfile();
  const { fecha } = await searchParams;
  const date = pickDate(fecha, overview.today);
  const deps = await trackingDeps(user.id);
  const [day, history] = await Promise.all([getTrackingDay(deps, user.id, date), getWellbeingHistory(deps, user.id, 14)]);
  const slept = history.filter((h) => h.sleepHours !== null);
  const avgSleep = slept.length ? slept.reduce((s, h) => s + (h.sleepHours ?? 0), 0) / slept.length : null;

  return (
    <main className={pageMain}>
      <PageHeader
        title="Sueño y ánimo"
        subtitle={<span className="capitalize">{dayLabel(date, overview.today)}</span>}
        back={{ href: "/", label: "Hoy" }}
      />
      <section className={panel}>
        <WellbeingForm key={date} date={date} sleepHours={day.wellbeing?.sleepHours ?? null} mood={day.wellbeing?.mood ?? null} />
      </section>

      {history.length > 0 ? (
        <section className={`${panel} overflow-hidden p-0`} aria-labelledby="ultimos-dias">
          <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
            <h2 id="ultimos-dias" className="font-medium">
              Últimas 2 semanas
            </h2>
            {avgSleep !== null ? (
              <span className="text-muted-foreground text-sm">
                Promedio {avgSleep.toLocaleString("es-AR", { maximumFractionDigits: 1 })} h
              </span>
            ) : null}
          </div>
          <ul className="divide-y border-t">
            {[...history].reverse().map((h) => {
              const Icon = h.mood ? MOOD_ICONS[h.mood] : null;
              return (
                <li key={h.date}>
                  <Link href={`/bienestar?fecha=${h.date}`} className="hover:bg-accent/50 flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm capitalize">{dayLabel(h.date, overview.today)}</span>
                    <span className="text-muted-foreground flex items-center gap-3 text-sm">
                      {h.sleepHours !== null ? `${h.sleepHours.toLocaleString("es-AR")} h` : ""}
                      {Icon && h.mood ? (
                        <span className="flex items-center gap-1">
                          <Icon aria-hidden className="size-4" />
                          {MOOD_LABELS[h.mood]}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
