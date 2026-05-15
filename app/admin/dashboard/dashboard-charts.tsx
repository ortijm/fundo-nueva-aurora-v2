"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { mes: string; monto: number }[];
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-surface px-3 py-2 text-sm">
        <p className="font-semibold" style={{ color: "var(--on-surface)" }}>{label}</p>
        <p style={{ color: "var(--primary)" }}>
          {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export function DashboardCharts({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barSize={32}>
        <XAxis
          dataKey="mes"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--on-surface-muted)" }}
        />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-low)" }} />
        <Bar
          dataKey="monto"
          radius={[6, 6, 0, 0]}
          fill="var(--primary)"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
