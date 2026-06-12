"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { getResultData } from "@/lib/server-action-utils";
import { generarGastosComunes, eliminarGastosComunes, previewEliminarGastosComunes } from "./actions";
import { formatPeriodo } from "@/lib/utils";

interface PeriodoItem { id: string; periodo: string; descripcion: string; }

interface PreviewData {
  tienePagados: boolean;
  pagados: number;
  pendientes: number;
  totalEcs: number;
  parcelasPagadas: string[];
}

export function GastosClient({ periodos }: { periodos: PeriodoItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [periodoGC, setPeriodoGC] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PeriodoItem | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleGenerarGC() {
    if (!periodoGC) { toast.error("Selecciona un período"); return; }
    const fd = new FormData();
    fd.set("periodo", periodoGC);
    toast.promise(generarGastosComunes(fd), {
      loading: "Generando gastos comunes...",
      success: (res) => {
        if (res.error) throw new Error(res.error);
        startTransition(() => router.refresh());
        const d = getResultData<{ creados?: number }>(res);
        return `Gastos comunes generados para ${d?.creados ?? 0} parcelas`;
      },
      error: (e) => e.message || "Error al generar",
    });
  }

  async function handlePreviewDelete(periodo: PeriodoItem) {
    setDeleteTarget(periodo);
    setShowDeleteModal(true);
    setPreview(null);

    const res = await previewEliminarGastosComunes(periodo.periodo);
    if (res.error) {
      toast.error(res.error);
      setShowDeleteModal(false);
      return;
    }
    const data = getResultData<PreviewData>(res);
    setPreview(data ?? null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await eliminarGastosComunes(deleteTarget.periodo);
      if (res.error) throw new Error(res.error);
      toast.success(`Gastos comunes de ${formatPeriodo(deleteTarget.periodo)} eliminados`);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setPreview(null);
      startTransition(() => router.refresh());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al eliminar";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Generar GC */}
      <div className="card-surface p-6 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--on-surface-muted)" }}>
          Generar Gastos Comunes del Período
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Período</label>
            <input
              type="month"
              value={periodoGC}
              onChange={(e) => setPeriodoGC(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            />
          </div>
          <button
            onClick={handleGenerarGC}
            disabled={isPending || !periodoGC}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
          >
            Generar Gastos
          </button>
        </div>
      </div>

      {/* Períodos generados */}
      {periodos.length > 0 && (
        <div className="card-surface p-6 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--on-surface-muted)" }}>
            Períodos Generados
          </p>
          <div className="space-y-2">
            {periodos.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                style={{ background: "var(--surface-low)" }}
              >
                <span className="text-sm" style={{ color: "var(--on-surface)" }}>
                  {formatPeriodo(p.periodo)}
                </span>
                <button
                  onClick={() => handlePreviewDelete(p)}
                  disabled={isPending || isDeleting}
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 disabled:opacity-40"
                  title="Eliminar gastos comunes de este período"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="card-surface w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h2 className="text-lg font-bold font-display" style={{ color: "var(--on-surface)" }}>
                Eliminar Gastos Comunes
              </h2>
            </div>

            <p className="text-sm mb-4" style={{ color: "var(--on-surface-muted)" }}>
              Al eliminar los gastos comunes del período{" "}
              <strong style={{ color: "var(--on-surface)" }}>{formatPeriodo(deleteTarget.periodo)}</strong>,
              se realizará lo siguiente:
            </p>

            <ul className="text-sm space-y-2 mb-4 pl-4" style={{ color: "var(--on-surface-muted)" }}>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                Se eliminarán los <strong style={{ color: "var(--on-surface)" }}>consumos de gastos comunes</strong> de todas las parcelas para este período.
              </li>
              {preview && preview.totalEcs > 0 && (
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  Se eliminarán <strong style={{ color: "var(--on-surface)" }}>{preview.pendientes} Estado(s) de Cuenta</strong> PENDIENTES asociados.
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                Deberá <strong style={{ color: "var(--on-surface)" }}>generar nuevamente</strong> los gastos comunes y estados de cuenta si desea mantenerlos.
              </li>
            </ul>

            {preview?.tienePagados && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                <p className="text-sm font-semibold text-red-400">
                  No se puede eliminar: {preview.pagados} EC(s) ya están PAGADOS.
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--on-surface-muted)" }}>
                  Parcelas: {preview.parcelasPagadas.join(", ")}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setPreview(null); }}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--surface-low)", color: "var(--on-surface-muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || preview?.tienePagados}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: preview?.tienePagados ? "var(--surface-low)" : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Eliminando...
                  </>
                ) : preview?.tienePagados ? (
                  "Bloqueado"
                ) : (
                  "Eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
