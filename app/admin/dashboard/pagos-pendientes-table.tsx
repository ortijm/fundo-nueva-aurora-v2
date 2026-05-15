"use client";

import { formatCLP, formatDate } from "@/lib/utils";

interface PagoItem {
  id: string;
  parcelaNumero: string;
  propietario: string | null;
  monto: number;
  fechaOperacion: string;
  estado: string;
}

export function PagosPendientesTable({ pagos }: { pagos: PagoItem[] }) {
  if (pagos.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: "var(--on-surface-muted)" }}>
        No hay pagos pendientes de validación.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm data-table">
        <thead>
          <tr>
            <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Unidad</th>
            <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Propietario</th>
            <th className="text-right py-3 px-3 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Monto</th>
            <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Fecha</th>
            <th className="text-center py-3 px-3 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
            <th className="py-3 px-3" />
          </tr>
        </thead>
        <tbody>
          {pagos.map((pago) => (
            <tr key={pago.id}>
              <td className="py-3 px-3 font-semibold rounded-l-lg" style={{ color: "var(--on-surface)" }}>
                {pago.parcelaNumero}
              </td>
              <td className="py-3 px-3" style={{ color: "var(--on-surface)" }}>
                {pago.propietario || "Sin propietario"}
              </td>
              <td className="py-3 px-3 text-right font-semibold" style={{ color: "var(--on-surface)" }}>
                {formatCLP(pago.monto)}
              </td>
              <td className="py-3 px-3" style={{ color: "var(--on-surface-muted)" }}>
                {formatDate(pago.fechaOperacion)}
              </td>
              <td className="py-3 px-3 text-center">
                <span className="chip-pending">Pendiente</span>
              </td>
              <td className="py-3 px-3 text-right rounded-r-lg">
                <a
                  href={`/admin/validacion?pago=${pago.id}`}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--primary)", background: "var(--secondary-container)" }}
                >
                  Revisar
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
