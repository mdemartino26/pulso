import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrengthChart } from "@/features/activity/components/strength-chart";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { activityDeps } from "@/server/services/activity-deps";
import { getStrengthHistory } from "@/server/services/activity-service";

export const metadata: Metadata = { title: "Historial del ejercicio" };

const kg = (v: number) => `${v.toLocaleString("es-AR")} kg`;
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
};

export default async function StrengthHistoryPage({ params }: PageProps<"/actividad/fuerza/[exerciseId]">) {
  const { user } = await requireCompleteProfile();
  const { exerciseId } = await params;
  const history = await getStrengthHistory(await activityDeps(user.id), user.id, exerciseId);
  if (!history) notFound();
  const { exercise, sessions } = history;
  const points = [...sessions]
    .reverse()
    .filter((s) => s.estimatedOneRepMax > 0)
    .map((s) => ({ date: s.date, label: shortDate(s.date), oneRepMax: s.estimatedOneRepMax }));
  const best = sessions.reduce((m, s) => Math.max(m, s.estimatedOneRepMax), 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header>
        <Button asChild variant="ghost" size="sm">
          <Link href="/actividad/fuerza">
            <ChevronLeft aria-hidden />
            Progreso
          </Link>
        </Button>
      </header>
      <div>
        <h1 className="text-xl font-semibold">{exercise.name}</h1>
        <p className="text-muted-foreground text-sm">
          {sessions.length} {sessions.length === 1 ? "sesión" : "sesiones"}
          {best > 0 ? ` · mejor 1RM estimado ${kg(best)}` : ""}
        </p>
      </div>

      {points.length >= 2 ? (
        <section className="bg-card rounded-3xl border backdrop-blur-xl p-3">
          <StrengthChart points={points} />
          <p className="text-muted-foreground px-1 pt-1 text-xs">
            1RM estimado (fórmula de Epley): sirve para comparar sesiones, no es un récord real.
          </p>
        </section>
      ) : null}

      {sessions.length > 0 ? (
        <ul className="bg-card divide-y overflow-hidden rounded-3xl border backdrop-blur-xl">
          {sessions.map((s) => (
            <li key={s.entryId} className="grid gap-1 px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/actividad/entrada/${s.entryId}`} className="text-sm font-medium capitalize underline-offset-2 hover:underline">
                  {shortDate(s.date)}
                </Link>
                <span className="text-muted-foreground text-xs">Volumen {kg(s.volumeKg)}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                {s.sets.map((x) => `${x.reps}×${x.weightKg > 0 ? kg(x.weightKg) : "peso corporal"}`).join(" · ")}
              </p>
              {s.estimatedOneRepMax > 0 ? (
                <p className="text-xs">
                  Mejor serie: {s.bestSet.reps}×{kg(s.bestSet.weightKg)} · 1RM ≈ {kg(s.estimatedOneRepMax)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Todavía no registraste series de este ejercicio.</p>
      )}
    </main>
  );
}
