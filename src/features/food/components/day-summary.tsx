import type { DailyTargets } from "@/lib/calc";
import type { Nutrients } from "@/lib/food";

const n = (v: number) => Math.round(v).toLocaleString("es-AR");

/**
 * Resumen del día. Sin rojos ni alarmas: pasarse un día no arruina nada,
 * lo que importa es la tendencia.
 */
export function DaySummary({ totals, targets }: { totals: Nutrients; targets: DailyTargets | null }) {
  const target = targets?.kcalTarget ?? null;
  const pct = target ? Math.min(100, (totals.kcal / target) * 100) : 0;
  const diff = target ? Math.round(target - totals.kcal) : null;

  return (
    <section aria-label="Resumen del día" className="bg-tile-sun text-tile-ink grid gap-4 rounded-[1.75rem] p-5 shadow-sm">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider uppercase">Consumido</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {n(totals.kcal)}
            {target ? <span className="text-tile-ink-soft text-base font-normal"> / {n(target)} kcal</span> : " kcal"}
          </p>
        </div>
        {diff !== null ? (
          <p className="text-tile-ink-soft text-right text-sm">
            {diff >= 0 ? (
              <>
                Te quedan <span className="font-semibold">{n(diff)} kcal</span>
              </>
            ) : (
              <>{n(-diff)} kcal por encima de la meta. Mañana seguimos.</>
            )}
          </p>
        ) : null}
      </div>
      {target ? (
        <div
          role="progressbar"
          aria-label="Calorías del día"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.round(totals.kcal)}
          className="h-2.5 overflow-hidden rounded-full bg-white/50"
        >
          <div className="bg-tile-ink h-full rounded-full transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-tile-ink-soft">Proteína</dt>
          <dd className="text-sm font-medium">
            {n(totals.protein)} g
            {targets ? <span className="text-tile-ink-soft font-normal"> / {targets.proteinMinG}–{targets.proteinMaxG}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-tile-ink-soft">Carbohidratos</dt>
          <dd className="text-sm font-medium">{n(totals.carbs)} g</dd>
        </div>
        <div>
          <dt className="text-tile-ink-soft">Grasas</dt>
          <dd className="text-sm font-medium">{n(totals.fat)} g</dd>
        </div>
      </dl>
    </section>
  );
}
