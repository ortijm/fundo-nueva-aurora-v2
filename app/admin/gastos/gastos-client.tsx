"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getResultData } from "@/lib/server-action-utils";
import { generarGastosComunes } from "./actions";
import { formatPeriodo } from "@/lib/utils";

interface PeriodoItem { id: string; periodo: string; descripcion: string; }

export function GastosClient({ periodos }: { periodos: PeriodoItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [periodoGC, setPeriodoGC] = useState("");

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

  return (
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
      {periodos.length > 0 && (
        <p className="text-xs mt-3" style={{ color: "var(--on-surface-muted)" }}>
          Último generado: {formatPeriodo(periodos[0].periodo)}
        </p>
      )}
    </div>
  );
}
