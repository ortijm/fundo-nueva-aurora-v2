import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { GastosClient } from "./gastos-client";

export const metadata: Metadata = { title: "Gastos Comunes" };

export default async function GastosPage() {
  const periodos = await prisma.periodoGasto.findMany({
    orderBy: { periodo: "desc" },
    take: 12,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Gastos Comunes
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Genera los gastos comunes mensuales para todas las parcelas activas.
        </p>
      </div>

      <GastosClient
        periodos={periodos.map((p) => ({
          id: p.id,
          periodo: p.periodo.toISOString(),
          descripcion: p.descripcion,
        }))}
      />
    </div>
  );
}
