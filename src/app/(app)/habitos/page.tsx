import type { Metadata } from "next";
import { PageHeader, pageMain, panel } from "@/components/page-header";
import { Tile, TileNote } from "@/components/tile";
import { HabitCheck } from "@/features/tracking/components/habit-check";
import { HabitRow, NewHabitForm } from "@/features/tracking/components/habit-manager";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { trackingDeps } from "@/server/services/tracking-deps";
import { getTrackingDay } from "@/server/services/tracking-service";

export const metadata: Metadata = { title: "Hábitos" };

export default async function HabitsPage() {
  const { user, overview } = await requireCompleteProfile();
  const day = await getTrackingDay(await trackingDeps(user.id), user.id, overview.today);

  return (
    <main className={pageMain}>
      <PageHeader
        title="Hábitos"
        subtitle="Contamos cuántos días de la última semana los hiciste. Un día salteado no borra nada."
      />

      {day.habits.length > 0 ? (
        <Tile color="lime" label="Hoy">
          <div className="grid gap-3 sm:grid-cols-2">
            {day.habits.map((h) => (
              <HabitCheck
                key={h.id}
                habitId={h.id}
                name={h.name}
                date={overview.today}
                doneToday={h.doneToday}
                done={h.done}
                window={h.window}
                days={h.days}
              />
            ))}
          </div>
          <TileNote>Tocá el cuadrado para marcar o desmarcar.</TileNote>
        </Tile>
      ) : null}

      <section className={panel}>
        <NewHabitForm suggest={day.habits.length === 0} />
      </section>

      {day.habits.length > 0 ? (
        <section className={`${panel} overflow-hidden p-0`} aria-labelledby="mis-habitos">
          <h2 id="mis-habitos" className="px-4 pt-4 pb-2 font-medium">
            Mis hábitos
          </h2>
          <ul className="divide-y border-t">
            {day.habits.map((h) => (
              <HabitRow key={h.id} id={h.id} name={h.name} done={h.done} window={h.window} />
            ))}
          </ul>
          <p className="text-muted-foreground px-4 py-3 text-xs">Archivar un hábito lo saca de la lista sin borrar lo que ya registraste.</p>
        </section>
      ) : null}
    </main>
  );
}
