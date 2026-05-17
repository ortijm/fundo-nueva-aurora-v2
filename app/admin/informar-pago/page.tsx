import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { InformarPagoAdminForm } from "./informar-pago-form";
import { getConfig } from "@/lib/services/config";


export const metadata: Metadata = { title: "Informar Pago - Administrador" };

export default async function InformarPagoAdminPage() {
  const session = await auth();
  if (!session) redirect("/login");
  
  // Check if user is admin
  if (session.user.rol !== "ADMINISTRADOR") {
    redirect("/admin/dashboard");
  }

  const [config, parcelas] = await Promise.all([
    getConfig(),
    prisma.parcela.findMany({
      where: { estado: "ACTIVA" },
      include: { propietario: true },
      orderBy: { numero: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Informar Pago - Administrador
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Registra un pago para una parcela específica. Los pagos informados por administradores se aprueban automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-3">
          <InformarPagoAdminForm parcelas={parcelas} />
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
                Los pagos informados por administradores se aprueban automáticamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}