"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { aprobarPago, rechazarPago } from "./actions";
import { formatCLP, formatDate, formatPeriodo } from "@/lib/utils";
import { CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";

interface PagoItem {
  id: string;
  parcelaNumero: string;
  propietario: string;
  monto: number;
  fechaOperacion: string;
  concepto: string;
  comprobante: string | null;
  estado: string;
  motivoRechazo: string;
  consumos: { id: string; tipo: string; periodo: string; total: number }[];
  creado: string;
}

export function ValidacionClient({
  pagos,
  selectedId,
  estadoFiltro,
}: {
  pagos: PagoItem[];
  selectedId?: string;
  estadoFiltro: string;
}) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [selected, setSelected] = useState<string | null>(selectedId || null);
  const [motivo, setMotivo] = useState("");
  const [showRechazo, setShowRechazo] = useState(false);
  const [filtro, setFiltro] = useState(estadoFiltro);

  const pagoSeleccionado = pagos.find((p) => p.id === selected);

  const filtrados = filtro
    ? pagos.filter((p) => p.estado === filtro)
    : pagos;

  const pendientes = pagos.filter((p) => p.estado === "PENDIENTE").length;

  async function handleAprobar() {
    if (!selected) return;
    setIsApproving(true);
    try {
      const result = await aprobarPago(selected);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Pago aprobado e ingresado al fondo.");
      setSelected(null);
      router.refresh();
    } finally {
      setIsApproving(false);
    }
  }

  async function handleRechazar() {
    if (!selected) return;
    setIsRejecting(true);
    try {
      const result = await rechazarPago(selected, motivo);
      if (!result.success) { toast.error(result.error); return; }
      toast.warning("Pago rechazado.");
      setShowRechazo(false);
      setMotivo("");
      setSelected(null);
      router.refresh();
    } finally {
      setIsRejecting(false);
    }
  }

  const estadoChip = (estado: string) => {
    if (estado === "APROBADO") return <span className="chip-confirmed">Aprobado</span>;
    if (estado === "RECHAZADO") return <span className="chip-error">Rechazado</span>;
    if (estado === "ANULADO") return <span className="chip-error">Anulado</span>;
    return <span className="chip-pending">Pendiente</span>;
  };

  return (
    <div className="flex gap-6">
      {/* Lista */}
      <div className="flex-1 min-w-0">
        {/* Filtros */}
        <div className="flex gap-2 mb-4">
          {["", "PENDIENTE", "APROBADO", "RECHAZADO"].map((e) => (
            <button
              key={e}
              onClick={() => { setFiltro(e); setSelected(null); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={
                filtro === e
                  ? { background: "var(--primary)", color: "white" }
                  : { background: "var(--surface-low)", color: "var(--on-surface-muted)" }
              }
            >
              {e || "Todos"} {e === "PENDIENTE" && pendientes > 0 && `(${pendientes})`}
            </button>
          ))}
        </div>

        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm data-table">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Propietario / Parcela</th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Monto</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Fecha</th>
                  <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm" style={{ color: "var(--on-surface-muted)" }}>
                      No hay pagos en esta categoría.
                    </td>
                  </tr>
                )}
                {filtrados.map((pago) => (
                  <tr
                    key={pago.id}
                    className="cursor-pointer transition-colors"
                    onClick={() => setSelected(pago.id === selected ? null : pago.id)}
                    style={selected === pago.id ? { background: "var(--secondary-container)" } : {}}
                  >
                    <td className="py-3 px-4 rounded-l-lg">
                      <p className="font-semibold" style={{ color: "var(--on-surface)" }}>{pago.propietario}</p>
                      <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Parcela {pago.parcelaNumero}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold" style={{ color: "var(--on-surface)" }}>
                      {formatCLP(pago.monto)}
                    </td>
                    <td className="py-3 px-4 text-xs" style={{ color: "var(--on-surface-muted)" }}>
                      {formatDate(pago.fechaOperacion)}
                    </td>
                    <td className="py-3 px-4 text-center">{estadoChip(pago.estado)}</td>
                    <td className="py-3 px-4 text-right rounded-r-lg">
                      <Eye size={14} style={{ color: "var(--on-surface-muted)" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Panel de detalle */}
      {pagoSeleccionado && (
        <div className="w-80 flex-shrink-0 space-y-4">
          <div className="card-surface p-5">
            <h3 className="font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
              Comprobante de Pago
            </h3>

            {pagoSeleccionado.comprobante ? (
              <a
                href={pagoSeleccionado.comprobante}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-40 rounded-xl overflow-hidden mb-4"
                style={{ background: "var(--surface-low)" }}
              >
                <Image
                  src={pagoSeleccionado.comprobante}
                  alt="Comprobante"
                  fill
                  className="object-cover"
                />
              </a>
            ) : (
              <div className="h-32 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--surface-low)" }}>
                <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Sin comprobante</p>
              </div>
            )}

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt style={{ color: "var(--on-surface-muted)" }}>Monto</dt>
                <dd className="font-bold" style={{ color: "var(--on-surface)" }}>{formatCLP(pagoSeleccionado.monto)}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: "var(--on-surface-muted)" }}>Fecha operación</dt>
                <dd className="font-medium" style={{ color: "var(--on-surface)" }}>{formatDate(pagoSeleccionado.fechaOperacion)}</dd>
              </div>
              {pagoSeleccionado.concepto && (
                <div>
                  <dt className="mb-0.5" style={{ color: "var(--on-surface-muted)" }}>Concepto</dt>
                  <dd className="text-xs" style={{ color: "var(--on-surface)" }}>{pagoSeleccionado.concepto}</dd>
                </div>
              )}
            </dl>

            {/* Consumos cubiertos */}
            {pagoSeleccionado.consumos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.04)]">
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--on-surface-muted)" }}>COBROS INCLUIDOS</p>
                {pagoSeleccionado.consumos.map((c) => (
                  <div key={c.id} className="flex justify-between text-xs py-1">
                    <span style={{ color: "var(--on-surface)" }}>{c.tipo} — {formatPeriodo(c.periodo)}</span>
                    <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{formatCLP(c.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {pagoSeleccionado.estado === "PENDIENTE" && (
              <div className="mt-5 space-y-2">
                {!showRechazo ? (
                  <>
                    <button
                      onClick={handleAprobar}
                      disabled={isApproving}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                      style={{ background: isApproving ? "var(--on-surface-muted)" : "var(--tertiary)" }}
                    >
                      {isApproving ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          Procesando Solicitud
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          Confirmar Pago
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowRechazo(true)}
                      disabled={isRejecting}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                      style={{ background: "var(--error-container)", color: "var(--error)" }}
                    >
                      <XCircle size={15} />
                      Rechazar (con motivo)
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      placeholder="Motivo del rechazo..."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded-lg resize-none"
                      style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                    />
                    <button
                      onClick={handleRechazar}
                      disabled={!motivo.trim() || isRejecting}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
                      style={{ background: isRejecting ? "var(--on-surface-muted)" : "var(--error)" }}
                    >
                      {isRejecting ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          Procesando Solicitud
                        </>
                      ) : (
                        "Confirmar Rechazo"
                      )}
                    </button>
                    <button
                      onClick={() => setShowRechazo(false)}
                      className="w-full py-2 text-xs"
                      style={{ color: "var(--on-surface-muted)" }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            {pagoSeleccionado.estado === "RECHAZADO" && pagoSeleccionado.motivoRechazo && (
              <div className="mt-4 p-3 rounded-xl" style={{ background: "var(--error-container)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--error)" }}>MOTIVO DE RECHAZO</p>
                <p className="text-xs" style={{ color: "var(--on-surface)" }}>{pagoSeleccionado.motivoRechazo}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
