"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearParcela, editarParcela, crearPropietario, editarPropietario, desactivarPropietario } from "./actions";
import { formatCLP } from "@/lib/utils";
import { Plus, Edit2, Bell, Search, Building2, Users, UserX } from "lucide-react";

interface PropietarioInfo { id: string; nombre: string; email: string; telefono?: string; }
interface ParcelaItem {
  id: string; numero: string; nombre: string; sector: string; superficieM2: number | null;
  estado: string; deudaTotal: number; deudaAgua: number; deudaLuz: number; deudaGc: number;
  propietarioId: string | null; propietario: PropietarioInfo | null;
}
interface ParcelaInfo {
  id: string;
  numero: string;
  estado: string;
}

interface UsuarioItem {
  id: string; username: string; nombre: string; firstName: string; lastName: string;
  email: string; telefono: string; isActive: boolean; parcelas: ParcelaInfo[];
}
interface Stats { total: number; pagadas: number; morosas: number; deudaTotal: number; }

export function PropiedadesClient({
  parcelas, usuarios, stats,
}: { parcelas: ParcelaItem[]; usuarios: UsuarioItem[]; stats: Stats }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"unidades" | "propietarios">("unidades");

  // Unidades state
  const [showParcelaModal, setShowParcelaModal] = useState(false);
  const [editandoParcela, setEditandoParcela] = useState<ParcelaItem | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Propietarios state
  const [showPropietarioModal, setShowPropietarioModal] = useState(false);
  const [editandoPropietario, setEditandoPropietario] = useState<UsuarioItem | null>(null);

  const filtradas = busqueda
    ? parcelas.filter(
        (p) =>
          p.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
          (p.propietario?.nombre || "").toLowerCase().includes(busqueda.toLowerCase())
      )
    : parcelas;

  async function handleParcelaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = editandoParcela ? await editarParcela(editandoParcela.id, fd) : await crearParcela(fd);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(editandoParcela ? "Propiedad actualizada" : "Propiedad creada");
    setShowParcelaModal(false);
    setEditandoParcela(null);
    startTransition(() => router.refresh());
  }

  async function handlePropietarioSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result = editandoPropietario
      ? await editarPropietario(editandoPropietario.id, fd)
      : await crearPropietario(fd);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(editandoPropietario ? "Propietario actualizado" : "Propietario creado");
    setShowPropietarioModal(false);
    setEditandoPropietario(null);
    startTransition(() => router.refresh());
  }

  async function handleDesactivar(id: string, nombre: string) {
    if (!confirm(`¿Desactivar a ${nombre}? Ya no podrá iniciar sesión.`)) return;
    const result = await desactivarPropietario(id);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Propietario desactivado");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      {/* Stats KPI */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
              {stats.total > 0 ? `${Math.round((stats.pagadas / stats.total) * 100)}%` : "—"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-muted)" }}>
              {stats.morosas} unidades en mora
            </p>
          </div>
          <div className="h-10 w-px" style={{ background: "var(--surface-low)" }} />
          <div className="text-center">
            <p className="text-lg font-bold font-display" style={{ color: "var(--on-surface)" }}>{stats.total}</p>
            <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Unidades</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold font-display" style={{ color: "var(--tertiary)" }}>{stats.pagadas}</p>
            <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Al día</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold font-display" style={{ color: "var(--on-surface)" }}>{usuarios.filter(u => u.isActive).length}</p>
            <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Propietarios</p>
          </div>
          {stats.deudaTotal > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--on-surface-muted)" }}>DEUDA TOTAL</p>
              <p className="text-lg font-bold" style={{ color: "var(--error)" }}>{formatCLP(stats.deudaTotal)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--surface-low)" }}>
        <button
          onClick={() => setTab("unidades")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={tab === "unidades"
            ? { background: "var(--surface-card)", color: "var(--on-surface)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
            : { color: "var(--on-surface-muted)" }}
        >
          <Building2 size={14} />
          Unidades ({parcelas.length})
        </button>
        <button
          onClick={() => setTab("propietarios")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={tab === "propietarios"
            ? { background: "var(--surface-card)", color: "var(--on-surface)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
            : { color: "var(--on-surface-muted)" }}
        >
          <Users size={14} />
          Propietarios ({usuarios.filter(u => u.isActive).length})
        </button>
      </div>

      {/* ─── TAB UNIDADES ──────────────────────────────────────────────── */}
      {tab === "unidades" && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--on-surface-muted)" }} />
              <input
                type="text"
                placeholder="Buscar unidad o propietario..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl"
                style={{ background: "var(--surface-card)", color: "var(--on-surface)" }}
              />
            </div>
            <button
              onClick={() => { setEditandoParcela(null); setShowParcelaModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
            >
              <Plus size={14} />
              Nueva Unidad
            </button>
          </div>

          <div className="card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm data-table">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Unidad</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Propietario</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Contacto</th>
                    <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
                    <th className="py-3 px-4 text-xs uppercase tracking-wider font-semibold text-center" style={{ color: "var(--on-surface-muted)" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm" style={{ color: "var(--on-surface-muted)" }}>
                        No hay unidades registradas.
                      </td>
                    </tr>
                  )}
                  {filtradas.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 rounded-l-lg">
                        <p className="font-bold" style={{ color: "var(--on-surface)" }}>{p.numero}</p>
                        {p.sector && <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>{p.sector}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium" style={{ color: "var(--on-surface)" }}>
                          {p.propietario?.nombre || <span style={{ color: "var(--on-surface-muted)" }}>Sin asignar</span>}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs" style={{ color: "var(--on-surface-muted)" }}>
                        {p.propietario?.email || "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.deudaTotal === 0 ? (
                          <span className="chip-confirmed">Al Corriente</span>
                        ) : (
                          <div>
                            <span className="chip-error">Moroso</span>
                            <p className="text-xs mt-1 font-semibold" style={{ color: "var(--error)" }}>
                              {formatCLP(p.deudaTotal)}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 rounded-r-lg">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setEditandoParcela(p); setShowParcelaModal(true); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--on-surface-muted)" }}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          {p.deudaTotal > 0 && (
                            <button
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: "var(--error)" }}
                              title="Enviar recordatorio"
                            >
                              <Bell size={14} />
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
        </>
      )}

      {/* ─── TAB PROPIETARIOS ──────────────────────────────────────────── */}
      {tab === "propietarios" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => { setEditandoPropietario(null); setShowPropietarioModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
            >
              <Plus size={14} />
              Nuevo Propietario
            </button>
          </div>

          <div className="card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm data-table">
                <thead>
                  <tr>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Nombre</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Usuario</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Contacto</th>
                    <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Parcelas</th>
                    <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm" style={{ color: "var(--on-surface-muted)" }}>
                        No hay propietarios registrados.
                      </td>
                    </tr>
                  )}
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 rounded-l-lg">
                        <p className="font-semibold" style={{ color: "var(--on-surface)" }}>{u.nombre}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs" style={{ color: "var(--on-surface-muted)" }}>
                        {u.username}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs" style={{ color: "var(--on-surface)" }}>{u.email || "—"}</p>
                        {u.telefono && <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>{u.telefono}</p>}
                      </td>
                      <td className="py-3 px-4">
                        {u.parcelas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.parcelas.map((p) => (
                              <span key={p.id} className="chip-confirmed" style={{ fontSize: 10 }}>{p.numero}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Sin parcela</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {u.isActive
                          ? <span className="chip-confirmed">Activo</span>
                          : <span className="chip-warning">Inactivo</span>}
                      </td>
                      <td className="py-3 px-4 rounded-r-lg">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditandoPropietario(u); setShowPropietarioModal(true); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--on-surface-muted)" }}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          {u.isActive && (
                            <button
                              onClick={() => handleDesactivar(u.id, u.nombre)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: "var(--error)" }}
                              title="Desactivar"
                            >
                              <UserX size={14} />
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
        </>
      )}

      {/* ─── MODAL PARCELA ─────────────────────────────────────────────── */}
      {showParcelaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="card-surface w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold font-display mb-5" style={{ color: "var(--on-surface)" }}>
              {editandoParcela ? `Editar Parcela ${editandoParcela.numero}` : "Nueva Propiedad"}
            </h2>
            <form onSubmit={handleParcelaSubmit} className="space-y-4">
              {!editandoParcela && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Número *</label>
                  <input name="numero" required className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} placeholder="Ej: A-101" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Nombre / Descripción</label>
                <input name="nombre" defaultValue={editandoParcela?.nombre || ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Sector / Ubicación</label>
                <input name="sector" defaultValue={editandoParcela?.sector || ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Propietario</label>
                <select name="propietarioId" defaultValue={editandoParcela?.propietarioId || ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}>
                  <option value="">Sin asignar</option>
                  {usuarios
                    .filter(u => u.isActive)
                    .map((u) => {
                      const parcelasStr = u.parcelas.length > 0 ? ` — ${u.parcelas.map(p => p.numero).join(", ")}` : "";
                      return (
                        <option key={u.id} value={u.id}>{u.nombre}{parcelasStr}</option>
                      );
                    })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Medidor Agua</label>
                  <input name="numeroMedidorAgua" defaultValue={editandoParcela ? "" : ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Medidor Luz</label>
                  <input name="numeroMedidorLuz" className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}>
                  {editandoParcela ? "Guardar Cambios" : "Crear Propiedad"}
                </button>
                <button type="button" onClick={() => { setShowParcelaModal(false); setEditandoParcela(null); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--surface-low)", color: "var(--on-surface-muted)" }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL PROPIETARIO ─────────────────────────────────────────── */}
      {showPropietarioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="card-surface w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold font-display mb-5" style={{ color: "var(--on-surface)" }}>
              {editandoPropietario ? "Editar Propietario" : "Nuevo Propietario"}
            </h2>
            <form onSubmit={handlePropietarioSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Nombre *</label>
                  <input name="firstName" required defaultValue={editandoPropietario?.firstName || ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} placeholder="José" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Apellido *</label>
                  <input name="lastName" required defaultValue={editandoPropietario?.lastName || ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} placeholder="González" />
                </div>
              </div>
              {!editandoPropietario && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Usuario *</label>
                  <input name="username" required className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} placeholder="jose.gonzalez" autoComplete="off" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Email</label>
                <input name="email" type="email" defaultValue={editandoPropietario?.email || ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} placeholder="jose@ejemplo.cl" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>Teléfono</label>
                <input name="telefono" defaultValue={editandoPropietario?.telefono || ""} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} placeholder="+56 9 1234 5678" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
                  {editandoPropietario ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
                </label>
                <input
                  name="password"
                  type="password"
                  required={!editandoPropietario}
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                  style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                  placeholder={editandoPropietario ? "••••••••" : "Mínimo 6 caracteres"}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}>
                  {editandoPropietario ? "Guardar Cambios" : "Crear Propietario"}
                </button>
                <button type="button" onClick={() => { setShowPropietarioModal(false); setEditandoPropietario(null); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--surface-low)", color: "var(--on-surface-muted)" }}>
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
