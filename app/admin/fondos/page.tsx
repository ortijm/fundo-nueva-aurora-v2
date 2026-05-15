import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { FondosClient } from "./fondos-client";
import { toDecimal, formatCLP } from "@/lib/utils";

export const metadata: Metadata = { title: "Fondo del Condominio" };

export default async function FondosPage() {
  const [transacciones, balance] = await Promise.all([
    prisma.fondoCondominio.findMany({
      include: { registradoPor: true },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
    prisma.fondoCondominio.groupBy({
      by: ["tipo"],
      _sum: { monto: true },
    }),
  ]);

  const totalIngresos = toDecimal(balance.find(b => b.tipo === "INGRESO")?._sum.monto);
  const totalEgresos = toDecimal(balance.find(b => b.tipo === "EGRESO")?._sum.monto);
  const balanceActual = totalIngresos - totalEgresos;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Fondo del Condominio
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Control de ingresos y egresos del fondo de administración.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Balance Actual</p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: balanceActual >= 0 ? "var(--tertiary)" : "var(--error)" }}>
            {formatCLP(balanceActual)}
          </p>
        </div>
        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Total Ingresos</p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: "var(--tertiary)" }}>{formatCLP(totalIngresos)}</p>
        </div>
        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Total Egresos</p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: "var(--error)" }}>{formatCLP(totalEgresos)}</p>
        </div>
      </div>

      <FondosClient
        transacciones={transacciones.map(t => ({
          id: t.id,
          tipo: t.tipo,
          concepto: t.concepto,
          monto: Number(t.monto),
          fecha: t.fecha.toISOString(),
          referencia: t.referencia,
          origenTipo: t.origenTipo,
          categoria: t.categoria,
          registradoPor: t.registradoPor
            ? `${t.registradoPor.firstName} ${t.registradoPor.lastName}`.trim() || t.registradoPor.username
            : null,
        }))}
      />
    </div>
  );
}
