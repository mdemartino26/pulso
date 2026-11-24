import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Droplet, ListChecks, Moon, Scale, Utensils, Beef } from "lucide-react";
import { PageHeader, pageMain, panel } from "@/components/page-header";
import { Tile, TileNote, TileValue } from "@/components/tile";
import { MOOD_LABELS } from "@/features/tracking/messages";
import { TrendChart } from "@/features/trends/components/trend-chart";
import { cn } from "@/lib/utils";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { trendsDeps } from "@/server/services/trends-deps";
import { RANGES, getTrends, pickRange, type Trends } from "@/server/services/trends-service";

export const metadata: Metadata = { title: "Tendencias" };

const n = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d });
const signed = (v: number, d = 1) => (v === 0 ? "0" : `${v > 0 ? "+" : "−"}${n(Math.abs(v), d)}`);
function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Frases cortas y amables sobre el período. Nunca retan: describen y animan. */
function insights(t: Trends, goal: string, weeklyRateKg: number): string[] {
  const s = t.summary;
  const out: string[] = [];
  if (s.food.loggedDays > 0) {
    out.push(
      s.food.nearTargetDays >= s.food.loggedDays / 2
        ? `Estuviste cerca de tu meta ${s.food.nearTargetDays} de los ${s.food.loggedDays} días que registraste. ¡Buen ritmo!`
        : `Registraste ${s.food.loggedDays} días. Mirá el promedio más que cada día suelto: es lo que mueve la aguja.`,
    );
  }
  if (s.weight.weeklyRate !== null && goal === "lose") {
    const rate = -s.weight.weeklyRate;
    if (rate > 0 && rate <= weeklyRateKg * 1.25) out.push(`Tu tendencia baja ${n(rate, 2)} kg por semana, en línea con el ritmo que elegiste.`);
    else if (rate > weeklyRateKg * 1.25) out.push(`Estás bajando más rápido de lo que elegiste (${n(rate, 2)} kg/sem). Comer un poco más también está bien.`);
    else out.push("Tu tendencia está estable. Las semanas con más retención de líquido son normales: seguí registrando.");
  }
  if (s.activity.activeDays > 0) out.push(`Te moviste ${s.activity.activeDays} de ${t.range} días, unos ${n(s.activity.weeklyMinutes)} minutos por semana.`);
  return out.slice(0, 3);
}

export default async function TrendsPage({ searchParams }: PageProps<"/tendencias">) {
  const { user, overview } = await requireCompleteProfile();
  const range = pickRange((await searchParams).dias);
  const fallback = overview.targets ?? { kcalTarget: 1500, proteinMinG: 0, proteinMaxG: 0, waterMl: 2000 };
  const t = await getTrends(await trendsDeps(overview.today), user.id, range, fallback);
  const s = t.summary;
  const label = (d: string) => (t.grouping === "week" ? `sem. ${shortDate(d)}` : shortDate(d));
  const data = t.series.map((p) => ({ ...p, label: label(p.date) }));
  const tips = insights(t, overview.profile.goal, overview.profile.weeklyRateKg);
  const habitPct = s.habits.possible ? Math.round((s.habits.done / s.habits.possible) * 100) : null;
  const avgMood = s.wellbeing.avgMood;

  return (
    <main className={cn(pageMain, "max-w-5xl")}>
      <PageHeader title="Tendencias" subtitle={`Del ${shortDate(t.from)} al ${shortDate(t.to)}. Los días sin registros no cuentan como cero.`} />

      <nav aria-label="Período" className="bg-muted grid w-full max-w-xs grid-cols-3 gap-1 rounded-2xl p-1">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/tendencias?dias=${r}`}
            aria-current={r === range ? "page" : undefined}
            className={cn(
              "rounded-xl py-1.5 text-center text-sm font-medium",
              r === range ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {r} días
          </Link>
        ))}
      </nav>

      {tips.length > 0 ? (
        <ul className={cn(panel, "grid gap-1.5 text-sm")} aria-label="Resumen">
          {tips.map((tip) => (
            <li key={tip}>· {tip}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile color="sun" label="Calorías promedio" icon={Utensils}>
          <TileValue value={s.food.avgKcal === null ? "–" : n(s.food.avgKcal)} unit="kcal" />
          <TileNote>Meta promedio {n(s.food.avgTarget)} kcal</TileNote>
          <TileNote strong>
            {s.food.loggedDays === 0 ? "Sin comidas registradas" : `${s.food.nearTargetDays} de ${s.food.loggedDays} días cerca de la meta`}
          </TileNote>
        </Tile>
        <Tile color="rose" label="Proteína" icon={Beef}>
          <TileValue value={s.food.avgProtein === null ? "–" : n(s.food.avgProtein)} unit="g/día" />
          <TileNote strong>{s.food.loggedDays === 0 ? "Sin datos" : `${s.food.proteinDays} de ${s.food.loggedDays} días llegaste al mínimo`}</TileNote>
        </Tile>
        <Tile color="lilac" label="Peso" icon={Scale}>
          <TileValue value={s.weight.change === null ? "–" : signed(s.weight.change)} unit="kg" />
          <TileNote>{s.weight.last !== null ? `Tendencia actual ${n(s.weight.last, 1)} kg` : "Registrá tu peso para ver la tendencia"}</TileNote>
          {s.weight.weeklyRate !== null ? <TileNote strong>{signed(s.weight.weeklyRate, 2)} kg por semana</TileNote> : null}
        </Tile>
        <Tile color="peach" label="Actividad" icon={Activity}>
          <TileValue value={n(s.activity.weeklyMinutes)} unit="min/sem" />
          <TileNote>{s.activity.avgSteps !== null ? `${n(s.activity.avgSteps)} pasos promedio` : "Sin pasos cargados"}</TileNote>
          <TileNote strong>
            {s.activity.activeDays} de {t.range} días con actividad
          </TileNote>
        </Tile>
        <Tile color="sky" label="Agua" icon={Droplet}>
          <TileValue value={s.water.avgMl === null ? "–" : n(s.water.avgMl / 1000, 2)} unit="L/día" />
          <TileNote strong>{s.water.loggedDays === 0 ? "Sin registros" : `${s.water.goalDays} de ${s.water.loggedDays} días llegaste a la meta`}</TileNote>
        </Tile>
        <Tile color="rose" label="Sueño y ánimo" icon={Moon}>
          <TileValue value={s.wellbeing.avgSleep === null ? "–" : n(s.wellbeing.avgSleep, 1)} unit="h" />
          <TileNote>{avgMood !== null ? `Ánimo promedio: ${MOOD_LABELS[Math.round(avgMood)]}` : "Sin ánimo cargado"}</TileNote>
        </Tile>
        <Tile color="lime" label="Hábitos" icon={ListChecks} className="col-span-2">
          <TileValue value={habitPct === null ? "–" : n(habitPct)} unit="%" />
          <TileNote>
            {s.habits.count === 0
              ? "Todavía no creaste hábitos."
              : `${s.habits.done} de ${s.habits.possible} posibles (${s.habits.count} ${s.habits.count === 1 ? "hábito" : "hábitos"} × ${t.range} días). Cada día cuenta, ninguno resta.`}
          </TileNote>
        </Tile>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className={panel} aria-labelledby="g-kcal">
          <h2 id="g-kcal" className="mb-2 font-medium">
            Calorías {t.grouping === "week" ? "(promedio por semana)" : "por día"}
          </h2>
          <TrendChart
            title="Calorías registradas y meta"
            data={data}
            bar={{ key: "kcal", name: "Registradas", color: "var(--tile-sun)" }}
            line={{ key: "kcalTarget", name: "Meta", color: "var(--muted-foreground)", dashed: true }}
            unit="kcal"
          />
        </section>
        <section className={panel} aria-labelledby="g-peso">
          <h2 id="g-peso" className="mb-2 font-medium">
            Tendencia de peso
          </h2>
          {data.some((d) => d.weightTrend !== null) ? (
            <TrendChart title="Tendencia de peso" data={data} line={{ key: "weightTrend", name: "Tendencia", color: "var(--chart-4)" }} unit="kg" digits={1} />
          ) : (
            <p className="text-muted-foreground text-sm">Todavía no hay pesos en este período.</p>
          )}
        </section>
        <section className={panel} aria-labelledby="g-act">
          <h2 id="g-act" className="mb-2 font-medium">
            Minutos de actividad {t.grouping === "week" ? "por semana" : "por día"}
          </h2>
          <TrendChart title="Minutos de actividad" data={data} bar={{ key: "minutes", name: "Minutos", color: "var(--tile-peach)" }} unit="min" />
        </section>
        <section className={panel} aria-labelledby="g-sueno">
          <h2 id="g-sueno" className="mb-2 font-medium">
            Sueño {t.grouping === "week" ? "(promedio por semana)" : "por día"}
          </h2>
          <TrendChart title="Horas de sueño" data={data} bar={{ key: "sleepHours", name: "Sueño", color: "var(--tile-lilac)" }} unit="h" digits={1} />
        </section>
      </div>
    </main>
  );
}
