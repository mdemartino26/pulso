import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteActivityAction, updateActivityAction } from "@/features/activity/actions";
import { ActivityForm } from "@/features/activity/components/activity-form";
import { ActionButton } from "@/features/food/components/action-form";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { activityDeps } from "@/server/services/activity-deps";
import { getActivityEntry } from "@/server/services/activity-service";

export const metadata: Metadata = { title: "Editar actividad" };

export default async function EditActivityPage({ params }: PageProps<"/actividad/entrada/[id]">) {
  const { user } = await requireCompleteProfile();
  const { id } = await params;
  const deps = await activityDeps(user.id);
  const entry = await getActivityEntry(deps, user.id, id);
  if (!entry) notFound();
  const [activities, exercises, weight] = await Promise.all([
    deps.catalog.activities(),
    deps.catalog.exercises(),
    deps.weights.latestOnOrBefore(user.id, entry.date),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/actividad?fecha=${entry.date}`}>
            <ChevronLeft aria-hidden />
            Volver
          </Link>
        </Button>
      </header>
      <h1 className="text-xl font-semibold">Editar actividad</h1>
      <ActivityForm
        activities={activities}
        exercises={exercises}
        weightKg={weight?.weightKg ?? null}
        action={updateActivityAction}
        submitLabel="Guardar cambios"
        hidden={{ entryId: entry.id }}
        initial={{
          metActivityId: entry.metActivityId,
          intensity: entry.intensity,
          durationMin: entry.durationMin,
          sets: entry.sets,
        }}
      />
      <ActionButton action={deleteActivityAction} fields={{ entryId: entry.id }} pendingLabel="Borrando…" variant="ghost">
        Borrar de este día
      </ActionButton>
    </main>
  );
}
