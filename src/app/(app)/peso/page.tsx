import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { PageHeader, pageMain, panel } from "@/components/page-header";
import { Tile, TileNote, TileValue } from "@/components/tile";
import { addDays } from "@/lib/calc";
import { ActionButton } from "@/features/food/components/action-form";
import { deleteWeightAction } from "@/features/tracking/actions";
import { WeightChart } from "@/features/tracking/components/weight-chart";
import { WeightForm } from "@/features/tracking/components/weight-form";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { trackingDeps } from "@/server/services/tracking-deps";
import { getWeightHistory } from "@/server/services/tracking-service";

export const metadata: Metadata = { title: "Peso" };

const n = (v: number, d = 1) => v.toLocaleString("es-AR", { maximumFractionDigits: d });
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
};

export default async function WeightPage() {
  const { user, overview } = await requireCompleteProfile();
  const history = await getWeightHistory(await trackingDeps(user.id), user.id, 90);
  const { latest, weeklyChange, points } = history;
  const recent = [...points].reverse().slice(0, 30);

  return (
    <main className={pageMain}>
      <PageHeader title="Peso" subtitle="Mirá la tendencia: el peso de un día solo sube y baja por agua, sal o digestión." />

      <div className="grid grid-cols-2 gap-3">
        <Tile color="lilac" label="Tendencia" icon={Scale}>
          <TileValue value={latest ? n(latest.trend) : "–"} unit="kg" />
          <TileNote>Promedio de los últimos 7 días</TileNote>
        </Tile>
        <Tile color="sky" label="En la semana">
          <TileValue
            value={weeklyChange === null ? "–" : weeklyChange === 0 ? "0" : `${weeklyChange > 0 ? "+" : "−"}${n(Math.abs(weeklyChange))}`}
            unit="kg"
          />
          <TileNote>{weeklyChange === null ? "Necesitamos un par de semanas de datos" : "Cambio de la tendencia"}</TileNote>
        </Tile>
      </div>

      <section className={panel} aria-labelledby="registrar-peso">
        <h2 id="registrar-peso" className="mb-3 font-medium">
          Registrar peso
        </h2>
        <WeightForm today={overview.today} minDate={addDays(overview.today, -366)} lastWeight={overview.weightKg} />
      </section>

      {points.length >= 2 ? (
        <section className={panel} aria-labelledby="grafico-peso">
          <h2 id="grafico-peso" className="mb-2 font-medium">
            Últimos 90 días
          </h2>
          <WeightChart points={points.map((p) => ({ label: shortDate(p.date), weightKg: p.weightKg, trend: p.trend }))} />
          <p className="text-muted-foreground text-xs">Los puntos son cada pesaje; la línea, el promedio de 7 días.</p>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className={`${panel} overflow-hidden p-0`} aria-labelledby="registros-peso">
          <h2 id="registros-peso" className="px-4 pt-4 pb-2 font-medium">
            Registros
          </h2>
          <ul className="divide-y border-t">
            {recent.map((p) => (
              <li key={p.date} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-sm capitalize">{shortDate(p.date)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">{n(p.weightKg)} kg</span>
                  {points.length > 1 ? (
                    <ActionButton
                      action={deleteWeightAction}
                      fields={{ date: p.date }}
                      pendingLabel="…"
                      variant="ghost"
                      className="text-muted-foreground h-8 px-2 text-xs"
                    >
                      Borrar
                    </ActionButton>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
