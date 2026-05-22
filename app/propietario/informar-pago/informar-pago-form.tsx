"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getResultData } from "@/lib/server-action-utils";
import { informarPago } from "./actions";
import { formatCLP, formatPeriodo } from "@/lib/utils";
import { Upload, CheckSquare, Square, FileCheck } from "lucide-react";

interface ConsumoItem {
  id: string;
  tipo: string;
  periodo: string;
  totalAPagar: number;
}

export function InformarPagoForm({
  parcelaId,
  consumosPendientes,
}: {
  parcelaId: string;
  consumosPendientes: ConsumoItem[];
  totalPendiente: number;
}) {
  const cancelUrl = `/propietario/dashboard?parcela=${parcelaId}`;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [seleccionados, setSeleccionados] = useState<string[]>(
    consumosPendientes.map((c) => c.id)
  );
  const [fileName, setFileName] = useState<string>("");
  const [fileError, setFileError] = useState(false);

  const totalSeleccionado = consumosPendientes
    .filter((c) => seleccionados.includes(c.id))
    .reduce((s, c) => s + c.totalAPagar, 0);

  function toggleConsumo(id: string) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setFileName(""); return; }

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato no válido. Usa JPG, PNG o PDF.");
      e.target.value = "";
      setFileName("");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 5 MB.");
      e.target.value = "";
      setFileName("");
      return;
    }

    setFileName(file.name);
    setFileError(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Validaciones cliente
    if (consumosPendientes.length > 0 && seleccionados.length === 0) {
      toast.error("Debes seleccionar al menos un concepto de pago.");
      return;
    }

    const concepto = (fd.get("concepto") as string)?.trim();
    if (!concepto) {
      toast.error("El concepto es obligatorio.");
      return;
    }

    const comprobante = fd.get("comprobante") as File | null;
    if (!comprobante || comprobante.size === 0) {
      toast.error("Debes adjuntar el comprobante de pago.");
      setFileError(true);
      return;
    }

    seleccionados.forEach((id) => fd.append("consumos[]", id));

    toast.promise(informarPago(fd), {
      loading: "Enviando pago...",
      success: (res) => {
        if (res.error) throw new Error(res.error);
        const d = getResultData<{ emailAdminEnviado?: boolean; emailAdminError?: string }>(res);
        if (!d?.emailAdminEnviado) {
          toast.warning(`Pago registrado, pero la notificación al administrador no pudo enviarse (${d?.emailAdminError ?? "error SMTP"}). Contáctalo directamente.`);
        }
        startTransition(() => router.push("/propietario/dashboard"));
        return "Pago informado correctamente. El administrador revisará tu comprobante en 24-48 hrs.";
      },
      error: (e) => e.message || "Error al informar pago",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 1. Concepto */}
      {consumosPendientes.length > 0 ? (
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold font-display mb-3" style={{ color: "var(--on-surface)" }}>
            1. Concepto de Pago *
          </h3>
          <div className="space-y-2">
            {consumosPendientes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleConsumo(c.id)}
                className="w-full flex items-center justify-between p-3 rounded-xl text-sm transition-colors"
                style={{
                  background: seleccionados.includes(c.id)
                    ? "var(--secondary-container)"
                    : "var(--surface-low)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  {seleccionados.includes(c.id) ? (
                    <CheckSquare size={16} style={{ color: "var(--primary)" }} />
                  ) : (
                    <Square size={16} style={{ color: "var(--on-surface-muted)" }} />
                  )}
                  <p className="font-medium text-left" style={{ color: "var(--on-surface)" }}>
                    {c.tipo} — {formatPeriodo(c.periodo)}
                  </p>
                </div>
                <span className="font-bold" style={{ color: "var(--on-surface)" }}>
                  {formatCLP(c.totalAPagar)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)]">
            <span className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>Total a pagar</span>
            <span className="text-lg font-bold font-display" style={{ color: "var(--primary)" }}>
              {formatCLP(totalSeleccionado)}
            </span>
          </div>
          <input type="hidden" name="monto" value={totalSeleccionado || ""} />
          <input type="hidden" name="parcelaId" value={parcelaId} />
        </div>
      ) : (
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold font-display mb-3" style={{ color: "var(--on-surface)" }}>
            1. Monto a Pagar
          </h3>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Monto ($)</label>
            <input
              name="monto"
              type="text"
              readOnly
              className="w-full px-3 py-2.5 text-sm rounded-xl font-bold"
              style={{ background: "var(--secondary-container)", color: "var(--primary)" }}
              value="Ingrese monto manualmente o seleccione conceptos arriba"
            />
          </div>
        </div>
      )}

      {/* 2. Detalles */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
          2. Detalles de Transferencia
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Fecha Operación *</label>
            <input
              name="fechaOperacion"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2.5 text-sm rounded-xl"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Concepto *</label>
            <input
              name="concepto"
              type="text"
              required
              className="w-full px-3 py-2.5 text-sm rounded-xl"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
              placeholder="Ej: Gastos Comunes Octubre 2025"
            />
          </div>
        </div>
      </div>

      {/* 3. Comprobante */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
          3. Comprobante de Pago *
        </h3>
        <label
          className="flex flex-col items-center justify-center w-full h-32 rounded-xl cursor-pointer border-2 border-dashed transition-colors"
          style={{
            borderColor: fileError ? "var(--error)" : fileName ? "var(--primary)" : "var(--outline-variant)",
            background: fileName ? "var(--secondary-container)" : "var(--surface-low)",
          }}
        >
          {fileName ? (
            <FileCheck size={20} style={{ color: "var(--primary)" }} />
          ) : (
            <Upload size={20} style={{ color: fileError ? "var(--error)" : "var(--on-surface-muted)" }} />
          )}
          <p className="text-sm mt-2 font-medium" style={{ color: fileName ? "var(--primary)" : fileError ? "var(--error)" : "var(--on-surface-muted)" }}>
            {fileName || (fileError ? "Comprobante requerido" : "Subir imagen o PDF")}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-muted)" }}>
            JPG, PNG, PDF · máx 5 MB
          </p>
          <input
            name="comprobante"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || (consumosPendientes.length > 0 && seleccionados.length === 0)}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
      >
        Notificar Pago Ahora
      </button>

      <a
        href={cancelUrl}
        className="block text-center text-sm py-2"
        style={{ color: "var(--on-surface-muted)" }}
      >
        Cancelar
      </a>
    </form>
  );
}
