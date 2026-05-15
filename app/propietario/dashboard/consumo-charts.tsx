"use client";

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { mes: string; agua: number; luz: number }[];
  tipo: "agua" | "luz";
  color: string;
}

export function ConsumoCharts({ data, tipo, color }: Props) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} barSize={16}>
        <XAxis
          dataKey="mes"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 9, fill: "var(--on-surface-muted)" }}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)} ${tipo === "agua" ? "m³" : "kWh"}`]}
          contentStyle={{ background: "var(--surface-card)", border: "none", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "var(--surface-low)" }}
        />
        <Bar dataKey={tipo} radius={[4, 4, 0, 0]} fill={color} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
