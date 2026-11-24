import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { activityDeps } from "@/server/services/activity-deps";
import { getTrainedExercises } from "@/server/services/activity-service";

export const metadata: Metadata = { title: "Progreso de fuerza" };

export default async function StrengthIndexPage() {
  const { user } = await requireCompleteProfile();
  const exercises = await getTrainedExercises(await activityDeps(user.id), user.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header>
        <Button asChild variant="ghost" size="sm">
          <Link href="/actividad">
            <ChevronLeft aria-hidden />
            Actividad
          </Link>
        </Button>
      </header>
      <h1 className="text-xl font-semibold">Progreso de fuerza</h1>
      {exercises.length > 0 ? (
        <ul className="bg-card divide-y rounded-xl border">
          {exercises.map((e) => (
            <li key={e.id}>
              <Link href={`/actividad/fuerza/${e.id}`} className="hover:bg-accent/50 flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium">{e.name}</span>
                  <span className="text-muted-foreground block text-xs capitalize">{e.muscleGroup}</span>
                </span>
                <ChevronRight aria-hidden className="text-muted-foreground size-4" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Cuando registres pesas o calistenia con series, acá vas a ver cómo evoluciona cada ejercicio.
        </p>
      )}
    </main>
  );
}
