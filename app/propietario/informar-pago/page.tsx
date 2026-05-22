import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { InformarPagoForm } from "./informar-pago-form";
import { getConfig } from "@/lib/services/config";
import { toDecimal } from "@/lib/utils";
import { ParcelaSelector } from "@/app/propietario/_components/parcela-selector";

export const metadata: Metadata = { title: "Informar Pago" };

export default async function InformarPagoPage({
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

  const [config, consumosPendientes] = await Promise.all([
    getConfig(),
    prisma.consumoMensual.findMany({
      where: {
        parcelaId: selectedParcelaId,
        estado: { in: ["CON_ESTADO_CUENTA"] },
        totalAPagar: { gt: 0 },
      },
      include: { tipoConsumo: true },
      orderBy: { periodo: "desc" },
    }),
  ]);

  const totalPendiente = consumosPendientes.reduce(
    (sum, c) => sum + toDecimal(c.totalAPagar),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
            Informar Pago
          </h1>
          <ParcelaSelector parcelas={parcelas} />
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Parcela {selectedParcela.numero} — completa los datos para validar tu pago.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-3">
          <InformarPagoForm
            parcelaId={selectedParcelaId}
            consumosPendientes={consumosPendientes.map((c) => ({
              id: c.id,
              tipo: c.tipoConsumo.nombre,
              periodo: c.periodo.toISOString(),
              totalAPagar: toDecimal(c.totalAPagar),
            }))}
            totalPendiente={totalPendiente}
          />
        </div>

        {/* Datos bancarios del condominio */}
        <div className="lg:col-span-2">
          <div className="card-surface p-6 sticky top-6">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--on-surface-muted)" }}>
              {config.nombreCondominio}
            </p>
            <dl className="space-y-3 text-sm">
              {config.banco && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Banco</dt>
                  <dd className="font-semibold" style={{ color: "var(--on-surface)" }}>{config.banco}</dd>
                </div>
              )}
              {config.tipoCuenta && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Tipo de Cuenta</dt>
                  <dd className="font-semibold" style={{ color: "var(--on-surface)" }}>{config.tipoCuenta}</dd>
                </div>
              )}
              {config.numeroCuenta && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Número de Cuenta</dt>
                  <dd className="font-bold text-base font-display" style={{ color: "var(--on-surface)" }}>{config.numeroCuenta}</dd>
                </div>
              )}
              {config.rutTitular && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--on-surface-muted)" }}>RUT Titular</dt>
                  <dd className="font-semibold" style={{ color: "var(--on-surface)" }}>{config.rutTitular}</dd>
                </div>
              )}
              {config.nombreTitular && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Nombre Titular</dt>
                  <dd className="font-semibold" style={{ color: "var(--on-surface)" }}>{config.nombreTitular}</dd>
                </div>
              )}
              {config.emailPagos && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Email para Pagos</dt>
                  <dd className="font-medium text-xs" style={{ color: "var(--primary)" }}>{config.emailPagos}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 p-3 rounded-xl" style={{ background: "var(--tertiary-container)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--tertiary)" }}>
                ⏱ Tiempo de Validación
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--tertiary)" }}>
                El administrador validará tu pago en un plazo de 24-48 horas hábiles.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
