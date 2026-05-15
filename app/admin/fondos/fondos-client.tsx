"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registrarGasto, editarTransaccionManual, eliminarTransaccionManual } from "./actions";
import { formatCLP, formatDate } from "@/lib/utils";
import { Plus, Edit2, Trash2, Filter } from "lucide-react";

interface TransaccionRow {
  id: string;
  tipo: string;
  concepto: string;
  monto: number;
  fecha: string;
  referencia: string | null;
  origenTipo: string | null;
  categoria: string | null;
  registradoPor: string | null;
}

interface Props {
  transacciones: TransaccionRow[];
}

const categoriaLabel: Record<string, string> = {
  MANTENIMIENTO: "Mantenimiento",
  SERVICIOS: "Servicios",
  SERVICIOS_PUBLICOS: "Servicios Públicos",
  REPARACION: "Reparación",
  OTRO: "Otro",
};

const origenLabel: Record<string, string> = {
  PAGO: "Pago EC",
  GASTO: "Gasto Común",
  MANUAL: "Gasto Manual",
  REVERSION_GASTO: "Rev. Gasto",
  REVERSION_PAGO: "Rev. Pago",
};

export function FondosClient({ transacciones }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editandoTransaccion, setEditandoTransaccion] = useState<TransaccionRow | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = editandoTransaccion
      ? await editarTransaccionManual(editandoTransaccion.id, fd)
      : await registrarGasto(fd);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(editandoTransaccion ? "Gasto actualizado" : "Gasto registrado");
    setShowModal(false);
    setEditandoTransaccion(null);
    startTransition(() => router.refresh());
  }

  async function handleEliminar(id: string, concepto: string) {
    if (!confirm(`¿Eliminar el gasto "${concepto}"?`)) return;
    const result = await eliminarTransaccionManual(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Gasto eliminado");
    startTransition(() => router.refresh());
  }

  function abrirEdicion(t: TransaccionRow) {
    setEditandoTransaccion(t);
    setShowModal(true);
  }

  const origenChip = (origen: string | null) => {
    if (!origen) return <span style={{ color: "var(--on-surface-muted)", fontSize: 11 }}>—</span>;
    const colors: Record<string, { bg: string; color: string }> = {
      PAGO: { bg: "var(--tertiary-container)", color: "var(--tertiary)" },
      GASTO: { bg: "var(--error-container)", color: "var(--error)" },
      MANUAL: { bg: "var(--secondary-container)", color: "var(--secondary)" },
      REVERSION_GASTO: { bg: "var(--surface-low)", color: "var(--on-surface-muted)" },
      REVERSION_PAGO: { bg: "var(--surface-low)", color: "var(--on-surface-muted)" },
    };
    const c = colors[origen] || { bg: "var(--surface-low)", color: "var(--on-surface-muted)" };
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", padding: "2px 8px",
        borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: c.bg, color: c.color
      }}>
        {origenLabel[origen] || origen}
      </span>
    );
  };

  const filteredTransacciones = transacciones.filter(t => {
    if (filtroCategoria) {
      if (filtroCategoria === "SIN_CATEGORIA") {
        if (t.categoria) return false;
      } else {
        if (t.categoria !== filtroCategoria) return false;
      }
    }
    if (filtroPeriodo) {
      const fechaTransaccion = new Date(t.fecha);
      const anioMes = `${fechaTransaccion.getFullYear()}-${String(fechaTransaccion.getMonth() + 1).padStart(2, "0")}`;
      if (anioMes !== filtroPeriodo) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold font-display" style={{ color: "var(--on-surface)" }}>
          Registro de Gastos
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: "var(--on-surface-muted)" }} />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            >
              <option value="">Todas las categorías</option>
              <option value="MANTENIMIENTO">Mantenimiento</option>
              <option value="SERVICIOS">Servicios</option>
              <option value="SERVICIOS_PUBLICOS">Servicios Públicos</option>
              <option value="REPARACION">Reparación</option>
              <option value="OTRO">Otro</option>
              <option value="SIN_CATEGORIA">Sin categoría</option>
            </select>
          </div>
          <input
            type="month"
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg"
            style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
          />
          <button
            onClick={() => { setEditandoTransaccion(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
          >
            <Plus size={14} />
            Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm data-table">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Fecha</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Concepto</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Categoría</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Origen</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Monto</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filteredTransacciones.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm" style={{ color: "var(--on-surface-muted)" }}>
                    Sin gastos registrados.
                  </td>
                </tr>
              )}
              {filteredTransacciones.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 px-4 text-xs rounded-l-lg" style={{ color: "var(--on-surface-muted)" }}>
                    {formatDate(t.fecha)}
                  </td>
                  <td className="py-3 px-4" style={{ color: "var(--on-surface)" }}>
                    <p className="font-medium">{t.concepto}</p>
                    {t.referencia && (
                      <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Ref: {t.referencia}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs" style={{ color: "var(--on-surface-muted)" }}>
                    {t.categoria ? categoriaLabel[t.categoria] || t.categoria : "—"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {origenChip(t.origenTipo)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold" style={{ color: t.tipo === "INGRESO" ? "var(--tertiary)" : "var(--error)" }}>
                    {t.tipo === "EGRESO" && "−"}{formatCLP(t.monto)}
                  </td>
                  <td className="py-3 px-4 rounded-r-lg">
                    {t.origenTipo === "MANUAL" && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEdicion(t)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "var(--primary)" }}
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleEliminar(t.id, t.concepto)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "var(--error)" }}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Gasto */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="card-surface w-full max-w-md p-6">
            <h2 className="text-lg font-bold font-display mb-5" style={{ color: "var(--on-surface)" }}>
              {editandoTransaccion ? "Editar Gasto" : "Nuevo Gasto"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Nombre del Gasto *</label>
                <input
                  name="nombre"
                  required
                  defaultValue={editandoTransaccion?.concepto || ""}
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Categoría</label>
                  <select
                    name="categoria"
                    defaultValue={editandoTransaccion?.categoria || "MANTENIMIENTO"}
                    className="w-full px-3 py-2.5 text-sm rounded-lg"
                    style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                  >
                    <option value="MANTENIMIENTO">Mantenimiento</option>
                    <option value="SERVICIOS">Servicios</option>
                    <option value="SERVICIOS_PUBLICOS">Servicios Públicos</option>
                    <option value="REPARACION">Reparación</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Monto ($) *</label>
                  <input
                    name="monto"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={editandoTransaccion?.monto || ""}
                    className="w-full px-3 py-2.5 text-sm rounded-lg"
                    style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Proveedor</label>
                <input
                  name="proveedor"
                  defaultValue={editandoTransaccion?.referencia || ""}
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Fecha del Gasto *</label>
                <input
                  name="fechaGasto"
                  type="date"
                  required
                  defaultValue={editandoTransaccion?.fecha?.split("T")[0] || new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Notas</label>
                <textarea
                  name="notas"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm rounded-lg resize-none"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
                >
                  {editandoTransaccion ? "Guardar Cambios" : "Registrar Gasto"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditandoTransaccion(null); }}
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
