"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getResultData } from "@/lib/server-action-utils";
import { enviarComunicadoAction } from "./actions";
import { formatDate } from "@/lib/utils";
import { Bell, Plus, Send, Check, AlertCircle, Clock } from "lucide-react";

interface NotificacionRow {
  id: string;
  tipo: string;
  asunto: string;
  destinatario: string;
  email: string | null;
  estadoEnvio: string;
  leido: boolean;
  creado: string;
  errorDetalle: string | null;
}

interface Props {
  notificaciones: NotificacionRow[];
}

export function NotificacionesClient({ notificaciones }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);

  const total = notificaciones.length;
  const enviados = notificaciones.filter(n => n.estadoEnvio === "ENVIADO").length;
  const errores = notificaciones.filter(n => n.estadoEnvio === "ERROR").length;
  const pendientes = notificaciones.filter(n => n.estadoEnvio === "PENDIENTE").length;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = await enviarComunicadoAction(fd);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const d = getResultData<{ ok?: number; errores?: number }>(result);
    const nOk = d?.ok ?? 0;
    const nErrores = d?.errores ?? 0;
    const errMsg = nErrores > 0 ? ` · ${nErrores} error${nErrores !== 1 ? "es" : ""}` : "";
    toast.success(`Comunicado enviado a ${nOk} destinatario${nOk !== 1 ? "s" : ""}${errMsg}`);
    setShowModal(false);
    startTransition(() => router.refresh());
  }

  const tipoLabel: Record<string, string> = {
    COMUNICADO: "Comunicado",
    ESTADO_CUENTA: "Estado de Cuenta",
    PAGO_APROBADO: "Pago Aprobado",
    PAGO_RECHAZADO: "Pago Rechazado",
    RECORDATORIO: "Recordatorio",
  };

  const tipoChipStyle: Record<string, { bg: string; color: string }> = {
    COMUNICADO: { bg: "var(--surface-low)", color: "var(--on-surface-muted)" },
    ESTADO_CUENTA: { bg: "rgba(23,51,90,0.12)", color: "var(--primary)" },
    PAGO_APROBADO: { bg: "var(--tertiary-container)", color: "var(--tertiary)" },
    PAGO_RECHAZADO: { bg: "var(--error-container)", color: "var(--error)" },
    RECORDATORIO: { bg: "rgba(255,160,0,0.12)", color: "#b45309" },
  };

  const estadoChip = (estado: string) => {
    switch (estado) {
      case "ENVIADO":
        return (
          <span className="chip-confirmed">
            <Check size={10} className="inline mr-1" />
            Enviado
          </span>
        );
      case "ERROR":
        return (
          <span className="chip-error">
            <AlertCircle size={10} className="inline mr-1" />
            Error
          </span>
        );
      case "PENDIENTE":
      default:
        return (
          <span className="chip-pending">
            <Clock size={10} className="inline mr-1" />
            Pendiente
          </span>
        );
    }
  };

  const tipoChip = (tipo: string) => {
    const s = tipoChipStyle[tipo] || { bg: "var(--surface-low)", color: "var(--on-surface-muted)" };
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", padding: "2px 8px",
        borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: s.bg, color: s.color,
      }}>
        {tipoLabel[tipo] || tipo}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Total</p>
          <p className="text-2xl font-bold font-display mt-1" style={{ color: "var(--on-surface)" }}>{total}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Enviados</p>
          <p className="text-2xl font-bold font-display mt-1" style={{ color: "var(--tertiary)" }}>{enviados}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Pendientes</p>
          <p className="text-2xl font-bold font-display mt-1" style={{ color: "var(--primary)" }}>{pendientes}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Errores</p>
          <p className="text-2xl font-bold font-display mt-1" style={{ color: "var(--error)" }}>{errores}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold font-display" style={{ color: "var(--on-surface)" }}>
          Historial de Notificaciones
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
        >
          <Plus size={14} />
          Enviar Comunicado
        </button>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm data-table">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Fecha</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Tipo</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Destinatario</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Asunto</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Leído</th>
              </tr>
            </thead>
            <tbody>
              {notificaciones.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm" style={{ color: "var(--on-surface-muted)" }}>
                    No hay notificaciones registradas.
                  </td>
                </tr>
              )}
              {notificaciones.map((n) => (
                <tr key={n.id}>
                  <td className="py-3 px-4 text-xs rounded-l-lg" style={{ color: "var(--on-surface-muted)" }}>
                    {formatDate(n.creado)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {tipoChip(n.tipo)}
                  </td>
                  <td className="py-3 px-4" style={{ color: "var(--on-surface)" }}>
                    <p className="font-medium">{n.destinatario}</p>
                    {n.email && (
                      <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>{n.email}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm" style={{ color: "var(--on-surface)" }}>
                    {n.asunto}
                    {n.errorDetalle && (
                      <p className="text-xs" style={{ color: "var(--error)" }}>{n.errorDetalle}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {estadoChip(n.estadoEnvio)}
                  </td>
                  <td className="py-3 px-4 text-center rounded-r-lg">
                    {n.leido ? (
                      <span className="chip-confirmed">Leído</span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", padding: "2px 10px",
                        borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: "var(--surface-low)", color: "var(--on-surface-muted)"
                      }}>No leído</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="card-surface w-full max-w-md p-6">
            <h2 className="text-lg font-bold font-display mb-5" style={{ color: "var(--on-surface)" }}>
              Enviar Comunicado
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Destinatarios</label>
                <select
                  name="destinatarios"
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                >
                  <option value="todos">Todos los propietarios</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Asunto *</label>
                <input
                  name="asunto"
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Mensaje *</label>
                <textarea
                  name="mensaje"
                  required
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm rounded-lg resize-none"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
                >
                  <Send size={14} />
                  Enviar
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface-muted)" }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
