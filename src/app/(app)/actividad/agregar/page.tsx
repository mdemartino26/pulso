import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addActivityAction } from "@/features/activity/actions";
import { ActivityForm } from "@/features/activity/components/activity-form";
import { dayLabel, pickDate } from "@/features/food/dates";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { activityDeps } from "@/server/services/activity-deps";

export const metadata: Metadata = { title: "Agregar actividad" };

export default async function AddActivityPage({ searchParams }: PageProps<"/actividad/agregar">) {
  const { user, overview } = await requireCompleteProfile();
  const { fecha } = await searchParams;
  const date = pickDate(fecha, overview.today);
  const deps = await activityDeps(user.id);
  const [activities, exercises, weight] = await Promise.all([
    deps.catalog.activities(),
    deps.catalog.exercises(),
    deps.weights.latestOnOrBefore(user.id, date),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/actividad?fecha=${date}`}>
            <ChevronLeft aria-hidden />
            Volver
          </Link>
        </Button>
        <span className="text-muted-foreground text-sm capitalize">{dayLabel(date, overview.today)}</span>
      </header>
      <h1 className="text-xl font-semibold">Agregar actividad</h1>
      <ActivityForm
        activities={activities}
        exercises={exercises}
        weightKg={weight?.weightKg ?? null}
        action={addActivityAction}
        submitLabel="Guardar actividad"
        hidden={{ date }}
      />
    </main>
  );
}
