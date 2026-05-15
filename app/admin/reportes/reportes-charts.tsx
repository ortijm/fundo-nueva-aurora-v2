"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatCLP } from "@/lib/utils";

interface BarData {
  mes: string;
  ingresos: number;
  egresos: number;
}

interface PieData {
  name: string;
  value: number;
  color: string;
}

const CustomBarTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; fill: string }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-surface px-3 py-2 text-xs space-y-1">
        <p className="font-semibold mb-1" style={{ color: "var(--on-surface)" }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.fill }}>
            {p.name === "ingresos" ? "Ingresos" : "Egresos"}: {formatCLP(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function IngresosEgresosChart({ data }: { data: BarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={16} barGap={4}>
        <XAxis
          dataKey="mes"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "var(--on-surface-muted)" }}
        />
        <YAxis hide />
        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "var(--surface-low)" }} />
        <Bar dataKey="ingresos" radius={[4, 4, 0, 0]} fill="var(--tertiary)" />
        <Bar dataKey="egresos" radius={[4, 4, 0, 0]} fill="var(--error)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

const RADIAN = Math.PI / 180;
const renderLabel = (props: {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number;
}) => {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function DeudaPieChart({ data }: { data: PieData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={90}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--on-surface)", fontSize: 11 }}>{value}</span>
          )}
        />
        <Tooltip
          formatter={(value) => [formatCLP(Number(value))]}
          contentStyle={{ background: "var(--surface-card)", border: "none", borderRadius: 8, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
