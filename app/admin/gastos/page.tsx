export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { GastosClient } from "./gastos-client";

export const metadata: Metadata = { title: "Gastos Comunes" };

export default async function GastosPage() {
  const periodos = await prisma.periodoGasto.findMany({
    orderBy: { periodo: "desc" },
    take: 12,
  });

  // Para cada período, verificar si tiene ECs con pagos aprobados
  const periodosConEstado = await Promise.all(
    periodos.map(async (p) => {
      const ecsPagados = await prisma.estadoCuenta.count({
        where: {
          periodo: p.periodo,
          estado: "PAGADO",
        },
      });
      return {
        id: p.id,
        periodo: p.periodo.toISOString(),
        descripcion: p.descripcion,
        tienePagados: ecsPagados > 0,
      };
    })
  );

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

      <GastosClient periodos={periodosConEstado} />
    </div>
  );
}
