"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendChartProps {
  title: string;
  data: Record<string, string | number | null>[];
  /** Serie en barras (lo registrado). */
  bar?: { key: string; name: string; color: string };
  /** Serie en línea (meta o tendencia). */
  line?: { key: string; name: string; color: string; dashed?: boolean };
  unit: string;
  digits?: number;
}

/** Gráfico simple de barras + línea, con los colores del tema (variables CSS). */
export function TrendChart({ title, data, bar, line, unit, digits = 0 }: TrendChartProps) {
  const fmt = (v: unknown) => `${Number(v).toLocaleString("es-AR", { maximumFractionDigits: digits })} ${unit}`;
  return (
    <div className="h-52 w-full" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis
            domain={line && !bar ? ["dataMin - 0.5", "dataMax + 0.5"] : [0, "auto"]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: digits })}
          />
          <Tooltip
            formatter={(v, name) => [fmt(v), name]}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            cursor={{ fill: "var(--accent)" }}
          />
          {bar ? <Bar dataKey={bar.key} name={bar.name} fill={bar.color} radius={[8, 8, 8, 8]} maxBarSize={28} isAnimationActive={false} /> : null}
          {line ? (
            <Line
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2.5}
              strokeDasharray={line.dashed ? "5 5" : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
