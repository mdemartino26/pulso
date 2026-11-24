"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ComposedChart, Tooltip, XAxis, YAxis } from "recharts";

export interface WeightPoint {
  label: string;
  weightKg: number;
  trend: number;
}

const kg = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`;

/** Pesos del día (puntos) y la tendencia de 7 días (línea): la línea es lo que importa. */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Gráfico de peso con la tendencia de 7 días">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            formatter={(v, name) => [kg(Number(v)), name === "trend" ? "Tendencia" : "Peso del día"]}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Scatter dataKey="weightKg" fill="var(--muted-foreground)" fillOpacity={0.55} isAnimationActive={false} />
          <Line type="monotone" dataKey="trend" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mini línea de tendencia para la tarjeta del panel. */
export function TrendSparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-12 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin - 0.3", "dataMax + 0.3"]} />
          <Line type="monotone" dataKey="v" stroke="var(--tile-ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
