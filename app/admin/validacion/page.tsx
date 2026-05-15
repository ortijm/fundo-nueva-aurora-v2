import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ValidacionClient } from "./validacion-client";

export const metadata: Metadata = { title: "Validación de Pagos" };

export default async function ValidacionPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; pago?: string }>;
}) {
  const params = await searchParams;

  const pagos = await prisma.pago.findMany({
    where: params.estado ? { estado: params.estado as "PENDIENTE" | "APROBADO" | "RECHAZADO" } : {},
    include: {
      parcela: { include: { propietario: true } },
      registradoPor: true,
      consumos: { include: { tipoConsumo: true } },
    },
    orderBy: { creado: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Validación de Pagos
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Revisa y aprueba los comprobantes de transferencia de los copropietarios.
        </p>
      </div>

      <ValidacionClient
        pagos={pagos.map((p) => ({
          id: p.id,
          parcelaNumero: p.parcela.numero,
          propietario:
            p.parcela.propietario
              ? `${p.parcela.propietario.firstName} ${p.parcela.propietario.lastName}`.trim() || p.parcela.propietario.username
              : "Sin propietario",
          monto: Number(p.monto),
          fechaOperacion: p.fechaOperacion.toISOString(),
          concepto: p.concepto,
          comprobante: p.comprobante,
          estado: p.estado,
          motivoRechazo: p.motivoRechazo,
          consumos: p.consumos.map((c) => ({
            id: c.id,
            tipo: c.tipoConsumo.nombre,
            periodo: c.periodo.toISOString(),
            total: Number(c.totalAPagar),
          })),
          creado: p.creado.toISOString(),
        }))}
        selectedId={params.pago}
        estadoFiltro={params.estado || ""}
      />
    </div>
  );
}
