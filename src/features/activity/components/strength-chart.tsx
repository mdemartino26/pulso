"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface StrengthPoint {
  date: string;
  label: string;
  oneRepMax: number;
}

/** Evolución del 1RM estimado por sesión. Usa los colores del tema (variables CSS). */
export function StrengthChart({ points }: { points: StrengthPoint[] }) {
  return (
    <div className="h-48 w-full" role="img" aria-label="Gráfico del 1RM estimado por sesión">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toLocaleString("es-AR")} kg`, "1RM estimado"]}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Line type="monotone" dataKey="oneRepMax" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
