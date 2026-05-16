"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generarEstadoCuenta, generarEstadosCuentaMasivo, generarEstadosCuentaMasivoSinNotificacion, sincronizarEstadosEC, eliminarEstadoCuenta } from "./actions";
import { getResultData } from "@/lib/server-action-utils";
import { formatCLP, formatDate } from "@/lib/utils";
import { FileText, RefreshCw, Layers, Download, CheckCheck, BellOff, Trash2 } from "lucide-react";

interface EstadoCuentaRow {
  id: string;
  parcelaId: string;
  parcelaNumero: string;
  propietario: string | null;
  email: string | null;
  subtotalAgua: number;
  subtotalLuz: number;
  subtotalGc: number;
  deudaAnterior: number;
  total: number;
  estado: string;
  fechaEmision: string | null;
}

interface ParcelaSinEc {
  id: string;
  numero: string;
  consumoCount: number;
}

interface Props {
  periodoActual: string;
  estadosCuenta: EstadoCuentaRow[];
  parcelasSinEc: ParcelaSinEc[];
}

export function EstadosCuentaClient({ periodoActual, estadosCuenta, parcelasSinEc }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [periodo, setPeriodo] = useState(periodoActual);
  const [generandoId, setGenerandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  // const [ecAEliminar, setEcAEliminar] = useState<EstadoCuentaRow | null>(null);

  function handlePeriodoChange(val: string) {
    setPeriodo(val);
    router.push(`/admin/estados-cuenta?periodo=${val}`);
  }

  async function handleSincronizar() {
    toast.promise(sincronizarEstadosEC(), {
      loading: "Sincronizando estados...",
      success: (res) => {
        if (res.error) throw new Error(res.error);
        startTransition(() => router.refresh());
        const d = getResultData<{ actualizados?: number }>(res);
        const n = d?.actualizados ?? 0;
        return n > 0
          ? `${n} estado${n !== 1 ? "s" : ""} de cuenta marcado${n !== 1 ? "s" : ""} como Pagado`
          : "Todo ya estaba sincronizado";
      },
      error: (e) => e.message || "Error al sincronizar",
    });
  }

  async function handleGenerarTodos() {
    toast.promise(generarEstadosCuentaMasivo(periodo), {
      loading: "Generando estados de cuenta...",
      success: (res) => {
        if (res.error) throw new Error(res.error);
        startTransition(() => router.refresh());
        const d = getResultData<{ ok?: number; errores?: string[] }>(res);
        const errMsg = d?.errores && d.errores.length > 0
          ? ` (${d.errores.length} errores)`
          : "";
        return `${d?.ok ?? 0} estados de cuenta generados${errMsg}`;
      },
      error: (e) => e.message || "Error al generar",
    });
  }

  async function handleGenerarSinNotificacion() {
    if (!confirm("¿Generar ECs sin enviar notificaciones por email?")) return;
    toast.promise(generarEstadosCuentaMasivoSinNotificacion(periodo), {
      loading: "Generando estados de cuenta...",
      success: (res) => {
        if (res.error) throw new Error(res.error);
        startTransition(() => router.refresh());
        const d = getResultData<{ ok?: number; omitidos?: string[]; errores?: string[] }>(res);
        const omitidos = d?.omitidos && d.omitidos.length > 0
          ? ` (${d.omitidos.length} ya existían)`
          : "";
        const errores = d?.errores && d.errores.length > 0
          ? `, ${d.errores.length} errores`
          : "";
        return `${d?.ok ?? 0} estados de cuenta creados${omitidos}${errores}`;
      },
      error: (e) => e.message || "Error al generar",
    });
  }

  async function handleGenerarUno(parcelaId: string, parcelaNumero: string) {
    setGenerandoId(parcelaId);
    const result = await generarEstadoCuenta(parcelaId, periodo);
    setGenerandoId(null);
    if (!result.success) {
      toast.error(`Error en ${parcelaNumero}: ${result.error}`);
      return;
    }
    toast.success(`Estado de cuenta generado para parcela ${parcelaNumero}`);
    startTransition(() => router.refresh());
  }

  async function handleEliminar(ec: EstadoCuentaRow) {
    if (ec.estado === "PAGADO") {
      toast.error("No se puede eliminar un estado de cuenta PAGADO");
      return;
    }
    if (!confirm(`¿Eliminar el estado de cuenta de la parcela ${ec.parcelaNumero}? Los consumos volveran a estado pendiente.`)) {
      return;
    }
    setEliminandoId(ec.id);
    const result = await eliminarEstadoCuenta(ec.id);
    setEliminandoId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Estado de cuenta eliminado");
    startTransition(() => router.refresh());
  }

  const puedeEliminar = (estado: string) => estado !== "PAGADO";

  const estadoChip = (estado: string) => {
    switch (estado) {
      case "EMITIDO": return <span className="chip-pending">Emitido</span>;
      case "PAGADO": return <span className="chip-confirmed">Pagado</span>;
      case "PARCIAL": return <span className="chip-warning">Parcial</span>;
      case "BORRADOR": return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--surface-low)", color: "var(--on-surface-muted)" }}>Borrador</span>;
      default: return <span className="chip-pending">{estado}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Período
            </label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => handlePeriodoChange(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {parcelasSinEc.length > 0 && (
              <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>
                <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{parcelasSinEc.length}</span> parcela{parcelasSinEc.length !== 1 ? "s" : ""} sin EC
              </p>
            )}
            <button
              onClick={handleSincronizar}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
              title="Marca como Pagado todos los EC cuyos consumos ya están pagados"
            >
              <CheckCheck size={14} />
              Sincronizar estados
            </button>
            <button
              onClick={handleGenerarTodos}
              disabled={isPending || parcelasSinEc.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
            >
              <Layers size={14} />
              Generar Todos
            </button>
            <button
              onClick={handleGenerarSinNotificacion}
              disabled={isPending || parcelasSinEc.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--tertiary-container)", color: "var(--tertiary)" }}
              title="Generar ECs sin enviar notificaciones por email"
            >
              <BellOff size={14} />
              Sin Notificación
            </button>
          </div>
        </div>
      </div>

      {/* Parcelas sin EC (pendientes de generar) */}
      {parcelasSinEc.length > 0 && (
        <div className="card-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.04)]">
            <h2 className="text-sm font-semibold font-display" style={{ color: "var(--on-surface)" }}>
              Parcelas con consumos pendientes (sin EC generado)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm data-table">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Parcela</th>
                  <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Consumos</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {parcelasSinEc.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-semibold rounded-l-lg" style={{ color: "var(--on-surface)" }}>
                      Parcela {p.numero}
                    </td>
                    <td className="py-3 px-4 text-center" style={{ color: "var(--on-surface-muted)" }}>
                      {p.consumoCount}
                    </td>
                    <td className="py-3 px-4 text-right rounded-r-lg">
                      <button
                        onClick={() => handleGenerarUno(p.id, p.numero)}
                        disabled={generandoId === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto transition-opacity disabled:opacity-40"
                        style={{ background: "var(--primary)", color: "white" }}
                      >
                        {generandoId === p.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <FileText size={12} />
                        )}
                        Generar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estados de cuenta generados */}
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.04)]">
          <h2 className="text-sm font-semibold font-display" style={{ color: "var(--on-surface)" }}>
            Estados de Cuenta Generados
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm data-table">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Parcela</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Propietario</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Agua</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Luz</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>GC</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Deuda Ant.</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Total</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
                  <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Emitido</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
            </thead>
            <tbody>
              {estadosCuenta.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm" style={{ color: "var(--on-surface-muted)" }}>
                    No hay estados de cuenta generados para este período.
                  </td>
                </tr>
              )}
              {estadosCuenta.map((ec) => (
                <tr key={ec.id}>
                  <td className="py-3 px-4 font-semibold rounded-l-lg" style={{ color: "var(--on-surface)" }}>
                    Parcela {ec.parcelaNumero}
                  </td>
                  <td className="py-3 px-4 text-sm" style={{ color: "var(--on-surface)" }}>
                    {ec.propietario || <span style={{ color: "var(--on-surface-muted)" }}>Sin propietario</span>}
                    {ec.email && (
                      <span className="block text-xs" style={{ color: "var(--on-surface-muted)" }}>{ec.email}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-xs" style={{ color: "var(--on-surface)" }}>
                    {ec.subtotalAgua > 0 ? formatCLP(ec.subtotalAgua) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-xs" style={{ color: "var(--on-surface)" }}>
                    {ec.subtotalLuz > 0 ? formatCLP(ec.subtotalLuz) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-xs" style={{ color: "var(--on-surface)" }}>
                    {ec.subtotalGc > 0 ? formatCLP(ec.subtotalGc) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-xs" style={{ color: ec.deudaAnterior > 0 ? "var(--error)" : "var(--on-surface-muted)" }}>
                    {ec.deudaAnterior > 0 ? formatCLP(ec.deudaAnterior) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold" style={{ color: "var(--on-surface)" }}>
                    {formatCLP(ec.total)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {estadoChip(ec.estado)}
                  </td>
                  <td className="py-3 px-4 text-center text-xs" style={{ color: "var(--on-surface-muted)" }}>
                    {ec.fechaEmision ? formatDate(ec.fechaEmision) : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <a
                        href={`/api/ec/${ec.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: "var(--surface-low)", color: "var(--primary)" }}
                      >
                        <Download size={12} />
                      </a>
                      {puedeEliminar(ec.estado) && (
                        <button
                          onClick={() => handleEliminar(ec)}
                          disabled={eliminandoId === ec.id}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                          style={{ background: "var(--error-container)", color: "var(--error)" }}
                          title="Eliminar estado de cuenta"
                        >
                          {eliminandoId === ec.id ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
