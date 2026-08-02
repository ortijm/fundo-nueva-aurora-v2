"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { guardarConfiguracion } from "./actions";

interface Config {
  nombreCondominio: string; rutCondominio: string; direccion: string; telefono: string; emailContacto: string;
  banco: string; tipoCuenta: string; numeroCuenta: string; emailPagos: string; rutTitular: string; nombreTitular: string;
  tarifaAgua1_10: number; tarifaAgua11_20: number; tarifaAgua21_30: number; tarifaAgua31_40: number; tarifaAgua41mas: number;
  costoLuzKwh: number;
  montoGcNuevo: number; montoGcConHistorial: number; mensajePieEc: string;
}

export function ConfiguracionForm({ config }: { config: Config }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = await guardarConfiguracion(fd);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Configuración guardada");
    startTransition(() => router.refresh());
  }

  const inputClass = "w-full px-3 py-2.5 text-sm rounded-xl";
  const inputStyle = { background: "var(--surface-low)", color: "var(--on-surface)" };
  const labelClass = "block text-xs font-semibold mb-1.5";
  const labelStyle = { color: "var(--on-surface-muted)" };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos del condominio */}
      <div className="card-surface p-6">
        <h2 className="text-sm font-bold font-display mb-4" style={{ color: "var(--on-surface)" }}>
          Datos del Condominio
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Nombre del Condominio</label>
            <input name="nombreCondominio" defaultValue={config.nombreCondominio} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>RUT / ID Fiscal</label>
            <input name="rutCondominio" defaultValue={config.rutCondominio} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Teléfono</label>
            <input name="telefono" defaultValue={config.telefono} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Email de Contacto</label>
            <input name="emailContacto" type="email" defaultValue={config.emailContacto} className={inputClass} style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} style={labelStyle}>Dirección</label>
            <input name="direccion" defaultValue={config.direccion} className={inputClass} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Datos bancarios */}
      <div className="card-surface p-6">
        <h2 className="text-sm font-bold font-display mb-4" style={{ color: "var(--on-surface)" }}>
          Datos Bancarios para Pagos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Banco</label>
            <input name="banco" defaultValue={config.banco} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Tipo de Cuenta</label>
            <select name="tipoCuenta" defaultValue={config.tipoCuenta} className={inputClass} style={inputStyle}>
              <option value="">Seleccionar...</option>
              <option value="Cuenta Corriente">Cuenta Corriente</option>
              <option value="Cuenta Vista">Cuenta Vista</option>
              <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
              <option value="Cuenta RUT">Cuenta RUT</option>
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Número de Cuenta</label>
            <input name="numeroCuenta" defaultValue={config.numeroCuenta} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Email para Pagos</label>
            <input name="emailPagos" type="email" defaultValue={config.emailPagos} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>RUT Titular</label>
            <input name="rutTitular" defaultValue={config.rutTitular} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Nombre Titular</label>
            <input name="nombreTitular" defaultValue={config.nombreTitular} className={inputClass} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Tarifas agua */}
      <div className="card-surface p-6">
        <h2 className="text-sm font-bold font-display mb-1" style={{ color: "var(--on-surface)" }}>
          Tarifas de Agua
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--on-surface-muted)" }}>
          Cobro escalonado sobre el sobreconsumo (m³ por encima de la franquicia)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Tramo 1–10 m³ ($ / m³)</label>
            <input name="tarifaAgua1_10" type="number" step="1" min="0" defaultValue={config.tarifaAgua1_10} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Tramo 11–20 m³ ($ / m³)</label>
            <input name="tarifaAgua11_20" type="number" step="1" min="0" defaultValue={config.tarifaAgua11_20} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Tramo 21–30 m³ ($ / m³)</label>
            <input name="tarifaAgua21_30" type="number" step="1" min="0" defaultValue={config.tarifaAgua21_30} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Tramo 31–40 m³ ($ / m³)</label>
            <input name="tarifaAgua31_40" type="number" step="1" min="0" defaultValue={config.tarifaAgua31_40} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Tramo 41+ m³ ($ / m³)</label>
            <input name="tarifaAgua41mas" type="number" step="1" min="0" defaultValue={config.tarifaAgua41mas} className={inputClass} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Otras tarifas */}
      <div className="card-surface p-6">
        <h2 className="text-sm font-bold font-display mb-4" style={{ color: "var(--on-surface)" }}>
          Otras Tarifas y Montos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Costo Luz por kWh ($)</label>
            <input name="costoLuzKwh" type="number" step="0.01" defaultValue={config.costoLuzKwh} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Gasto Común Nuevo Propietario ($)</label>
            <input name="montoGcNuevo" type="number" step="1" defaultValue={config.montoGcNuevo} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Gasto Común Con Historial ($)</label>
            <input name="montoGcConHistorial" type="number" step="1" defaultValue={config.montoGcConHistorial} className={inputClass} style={inputStyle} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelClass} style={labelStyle}>Mensaje Pie de Estado de Cuenta</label>
            <textarea name="mensajePieEc" defaultValue={config.mensajePieEc} rows={2} className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-8 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
        >
          Guardar Configuración
        </button>
      </div>
    </form>
  );
}
