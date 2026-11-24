import Link from "next/link";
import { ChevronRight, UserRound, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { foodDeps } from "@/server/services/food-deps";
import { getDayLog } from "@/server/services/food-service";

/**
 * Inicio provisorio: muestra las metas de hoy. En la Etapa 7 se reemplaza
 * por el panel del día.
 */
export default async function HomePage() {
  const { user, overview } = await requireCompleteProfile();
  const { targets } = overview;
  const log = await getDayLog(await foodDeps(user.id), user.id, overview.today);
  const n = (v: number) => v.toLocaleString("es-AR");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pulso</h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon" aria-label="Perfil">
            <Link href="/perfil">
              <UserRound aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      {targets ? (
        <section aria-label="Tus metas de hoy" className="bg-card grid gap-4 rounded-xl border p-5 shadow-xs">
          <div>
            <p className="text-muted-foreground text-sm">Tu meta de hoy</p>
            <p className="text-4xl font-semibold tracking-tight">
              {n(targets.kcalTarget)} <span className="text-muted-foreground text-base font-normal">kcal</span>
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Gasto estimado</dt>
              <dd className="text-sm font-medium">{n(targets.tdeeKcal)} kcal</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Proteína</dt>
              <dd className="text-sm font-medium">
                {targets.proteinMinG}–{targets.proteinMaxG} g
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Agua</dt>
              <dd className="text-sm font-medium">
                {(targets.waterMl / 1000).toLocaleString("es-AR")} L
              </dd>
            </div>
          </dl>
          {targets.floorApplied ? (
            <p className="text-muted-foreground text-xs">
              Ajustamos tu meta al mínimo recomendado para cubrir tus necesidades básicas.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="bg-card rounded-xl border p-5 text-sm">
          Registrá tu peso en <Link className="underline" href="/perfil">tu perfil</Link> para calcular tus metas.
        </section>
      )}

      <Link
        href="/comidas"
        className="bg-card hover:bg-accent/50 flex items-center gap-4 rounded-xl border p-4 shadow-xs"
      >
        <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-full">
          <Utensils aria-hidden className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block font-medium">Comidas</span>
          <span className="text-muted-foreground text-sm">
            {log.totals.kcal > 0 ? `${n(Math.round(log.totals.kcal))} kcal registradas hoy` : "Todavía no registraste nada hoy"}
          </span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-5" />
      </Link>

      <p className="text-muted-foreground text-sm">
        Muy pronto vas a poder registrar actividad, agua y hábitos desde acá.
      </p>
    </main>
  );
}
