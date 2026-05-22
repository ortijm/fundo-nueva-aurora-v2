import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCLP, formatPeriodo, formatDate, toDecimal } from "@/lib/utils";
import { Download } from "lucide-react";
import { ParcelaSelector } from "@/app/propietario/_components/parcela-selector";

export const metadata: Metadata = { title: "Estados de Cuenta" };

export default async function EstadosCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ parcela?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const resolvedSearchParams = await searchParams;

  const parcelas = await prisma.parcela.findMany({
    where: { propietarioId: session.user.id, estado: "ACTIVA" },
    select: { id: true, numero: true, nombre: true },
  });

  if (parcelas.length === 0) {
    return (
      <div className="text-center py-16">
        <p style={{ color: "var(--on-surface-muted)" }}>No tienes parcela asignada.</p>
      </div>
    );
  }

  const selectedParcelaId = resolvedSearchParams.parcela && parcelas.some(p => p.id === resolvedSearchParams.parcela)
    ? resolvedSearchParams.parcela
    : parcelas[0].id;

  const selectedParcela = parcelas.find(p => p.id === selectedParcelaId)!;

  const estadosCuenta = await prisma.estadoCuenta.findMany({
    where: { parcelaId: selectedParcelaId },
    include: {
      consumos: { include: { tipoConsumo: true } },
    },
    orderBy: { periodo: "desc" },
  });

  const estadoLabel: Record<string, string> = {
    BORRADOR: "Borrador",
    EMITIDO: "Emitido",
    PAGADO: "Pagado",
    PARCIAL: "Pago Parcial",
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
            Estados de Cuenta
          </h1>
          <ParcelaSelector parcelas={parcelas} />
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Parcela {selectedParcela.numero} — Historial completo de cobros.
          {selectedParcela.nombre && ` (${selectedParcela.nombre})`}
        </p>
      </div>

      {estadosCuenta.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>
            Aún no tienes estados de cuenta emitidos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {estadosCuenta.map((ec) => (
            <div key={ec.id} className="card-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold font-display" style={{ color: "var(--on-surface)" }}>
                    {formatPeriodo(ec.periodo)}
                  </p>
                  {ec.fechaEmision && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-muted)" }}>
                      Emitido el {formatDate(ec.fechaEmision)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      ec.estado === "PAGADO"
                        ? "chip-confirmed"
                        : ec.estado === "EMITIDO"
                        ? "chip-pending"
                        : "chip-warning"
                    }
                  >
                    {estadoLabel[ec.estado] || ec.estado}
                  </span>
                  <a
                    href={`/api/ec/${ec.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "var(--secondary-container)", color: "var(--primary)" }}
                  >
                    <Download size={12} />
                    PDF
                  </a>
                </div>
              </div>

              {/* Detalle de consumos */}
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.04)]">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {toDecimal(ec.subtotalAgua) > 0 && (
                    <div>
                      <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Agua</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>{formatCLP(toDecimal(ec.subtotalAgua))}</p>
                    </div>
                  )}
                  {toDecimal(ec.subtotalLuz) > 0 && (
                    <div>
                      <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Luz</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>{formatCLP(toDecimal(ec.subtotalLuz))}</p>
                    </div>
                  )}
                  {toDecimal(ec.subtotalGc) > 0 && (
                    <div>
                      <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Gasto Común</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>{formatCLP(toDecimal(ec.subtotalGc))}</p>
                    </div>
                  )}
                  {toDecimal(ec.deudaAnterior) > 0 && (
                    <div>
                      <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Deuda Anterior</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--error)" }}>{formatCLP(toDecimal(ec.deudaAnterior))}</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-3">
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Total</p>
                    <p className="text-xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
                      {formatCLP(toDecimal(ec.total))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
