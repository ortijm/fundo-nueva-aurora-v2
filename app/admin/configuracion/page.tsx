export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { getConfig } from "@/lib/services/config";
import { ConfiguracionForm } from "./configuracion-form";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const config = await getConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Configuración del Sistema
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Datos del condominio, tarifas y datos bancarios para pagos.
        </p>
      </div>

      <ConfiguracionForm
        config={{
          nombreCondominio: config.nombreCondominio,
          rutCondominio: config.rutCondominio,
          direccion: config.direccion,
          telefono: config.telefono,
          emailContacto: config.emailContacto,
          banco: config.banco,
          tipoCuenta: config.tipoCuenta,
          numeroCuenta: config.numeroCuenta,
          emailPagos: config.emailPagos,
          rutTitular: config.rutTitular,
          nombreTitular: config.nombreTitular,
          franquiciaAguaM3: Number(config.franquiciaAguaM3),
          tarifaAgua1_10: Number(config.tarifaAgua1_10),
          tarifaAgua11_20: Number(config.tarifaAgua11_20),
          tarifaAgua21_30: Number(config.tarifaAgua21_30),
          tarifaAgua31_40: Number(config.tarifaAgua31_40),
          tarifaAgua41mas: Number(config.tarifaAgua41mas),
          costoLuzKwh: Number(config.costoLuzKwh),
          montoGcNuevo: Number(config.montoGcNuevo),
          montoGcConHistorial: Number(config.montoGcConHistorial),
          mensajePieEc: config.mensajePieEc,
        }}
      />
    </div>
  );
}
