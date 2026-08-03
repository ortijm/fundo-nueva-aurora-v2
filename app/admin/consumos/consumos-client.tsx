"use client";

/* eslint-disable react-hooks/static-components */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { guardarLectura, importarExcelConsumos, actualizarLecturaConsumo } from "./actions";
import { formatCLP } from "@/lib/utils";
import { Upload, Check, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface TipoConsumo {
  id: string;
  nombre: string;
  unidadMedida: string;
  esVariable: boolean;
}

interface ConsumoRow {
  id?: string;
  tipoConsumoId: string;
  tipoNombre: string;
  lecturaAnterior: number;
  lecturaActual: number;
  consumoCalculado: number;
  totalAPagar: number;
  estado: string;
}

interface ParcelaRow {
  id: string;
  numero: string;
  nombre: string;
  propietario: string | null;
  consumos: ConsumoRow[];
}

interface Props {
  parcelas: ParcelaRow[];
  tiposConsumo: TipoConsumo[];
  todasParcelas: { id: string; numero: string; nombre: string | null }[];
  periodoActual: string;
  tipoSeleccionado: string;
  parcelaSeleccionada: string;
  progreso: { total: number; registradas: number };
}

export function ConsumosClient({
  parcelas,
  tiposConsumo,
  todasParcelas,
  periodoActual,
  tipoSeleccionado,
  parcelaSeleccionada,
  progreso,
}: Props) {
  const router = useRouter();
  const startTransition = useTransition()[1];
  const [lecturas, setLecturas] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(periodoActual);
  const [tipo, setTipo] = useState(tipoSeleccionado);
  const [parcela, setParcela] = useState(parcelaSeleccionada);
  // Edición AJAX de lecturas (spec edicion-lecturas-consumos): valores editados por fila + fila en guardado
  const [edicion, setEdicion] = useState<Record<string, { anterior: string; actual: string }>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const tipoActual = tiposConsumo.find((t) => t.id === tipo);
  const esTodos = tipo === "todos";
  const pct = progreso.total > 0 ? Math.round((progreso.registradas / progreso.total) * 100) : 0;

  function navigate(newTipo: string, newPeriodo: string, newParcela: string) {
    const p = new URLSearchParams();
    p.set("tipo", newTipo);
    p.set("periodo", newPeriodo);
    if (newParcela && newParcela !== "todas") p.set("parcela", newParcela);
    router.push(`/admin/consumos?${p.toString()}`);
  }

  async function handleGuardar(parcelaId: string) {
    const lectura = lecturas[parcelaId];
    if (!lectura) { toast.error("Ingresa una lectura"); return; }

    setSavingId(parcelaId);
    const fd = new FormData();
    fd.set("parcelaId", parcelaId);
    fd.set("tipoConsumoId", tipo);
    fd.set("periodo", periodo);
    fd.set("lecturaActual", lectura);

    const result = await guardarLectura(fd);
    setSavingId(null);
    if (!result.success) { toast.error(result.error); return; }

    toast.success("Lectura guardada");
    setLecturas((prev) => { const next = { ...prev }; delete next[parcelaId]; return next; });
    startTransition(() => router.refresh());
  }

  // ─── Edición AJAX de lecturaAnterior/lecturaActual (Requisitos 1–4) ─────
  async function guardarConsumoFila(rowKey: string, consumo: ConsumoRow) {
    if (!consumo.id) return;
    if (guardando) return; // Escenario 7: bloquea el doble guardado mientras uno está en curso

    const actual = parseFloat(edicion[rowKey]?.actual ?? String(consumo.lecturaActual));
    if (isNaN(actual) || actual < 0) {
      toast.error("La lectura debe ser un número mayor o igual a 0");
      return;
    }

    setGuardando(rowKey);
    try {
      const result = await actualizarLecturaConsumo(consumo.id, actual);
      if (!result.success) {
        toast.error(result.error); // conserva los valores editados para corregirlos
        return;
      }
      toast.success("Cambio realizado, datos actualizados");
      setEdicion((prev) => { const next = { ...prev }; delete next[rowKey]; return next; });
      startTransition(() => router.refresh());
    } finally {
      setGuardando(null);
    }
  }

  // Celda editable SOLO si estado === "PENDIENTE"; si no, input disabled con tooltip (Requisito 4)
  // lecturaAnterior: SIEMPRE disabled (inclusive en PENDIENTE)
  // lecturaActual: editable solo en estado === "PENDIENTE"
  function renderCeldaLectura(rowKey: string, consumo: ConsumoRow, campo: "anterior" | "actual") {
    const editable = campo === "actual" && consumo.estado === "PENDIENTE";
    const bloqueada = guardando === rowKey;
    const valorBase = campo === "anterior" ? consumo.lecturaAnterior : consumo.lecturaActual;
    const valor = edicion[rowKey]?.[campo] ?? String(valorBase);

    return (
      <input
        type="number"
        min="0"
        step="0.01"
        value={valor}
        disabled={!editable || bloqueada}
        onChange={(e) =>
          setEdicion((prev) => ({
            ...prev,
            [rowKey]: {
              anterior: prev[rowKey]?.anterior ?? String(consumo.lecturaAnterior),
              actual: prev[rowKey]?.actual ?? String(consumo.lecturaActual),
              [campo]: e.target.value,
            },
          }))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") guardarConsumoFila(rowKey, consumo);
        }}
        onBlur={() => guardarConsumoFila(rowKey, consumo)}
        className="w-28 text-right px-2 py-1.5 text-sm rounded-lg disabled:opacity-50"
        style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
        title={!editable ? (campo === "anterior" ? "La lectura anterior no es editable" : "Consumo asociado a estado de cuenta o pago") : undefined}
      />
    );
  }

  function handleDescargarPlantilla() {
    const tiposVariables = tiposConsumo.filter((t) => t.esVariable);
    const rows: Record<string, string | number>[] = [];

    for (const p of parcelas) {
      for (const t of tiposVariables) {
        const consumoExistente = p.consumos.find((c) => c.tipoConsumoId === t.id);
        rows.push({
          "N° Parcela": p.numero,
          "Tipo": t.nombre,
          "Período (AAAA-MM)": periodo,
          "Lectura Anterior (solo 1er registro)": consumoExistente ? consumoExistente.lecturaActual : "",
          "Lectura Actual": "",
          "Observaciones": "",
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lecturas");
    XLSX.writeFile(wb, `plantilla_consumos_${periodo}.xlsx`);
  }

  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);

    const data = rows.map((r) => {
      const parcelaNumero = String(r["N° Parcela"] || r["N° Parcela *"] || r["parcela"] || "").trim();
      const tipoNombreExcel = String(r["Tipo"] || "").trim();
      const periodoExcel = String(r["Período (AAAA-MM)"] || r["Período"] || "").trim();
      const lecturaActual = Number(r["Lectura Actual"] || r["Lectura Actual *"] || r["lectura_actual"] || 0);
      const lecturaAnteriorRaw = r["Lectura Anterior (solo 1er registro)"] ?? r["Lectura Anterior"] ?? "";
      const lecturaAnterior = lecturaAnteriorRaw !== "" ? Number(lecturaAnteriorRaw) : undefined;
      const observaciones = String(r["Observaciones"] || "").trim();

      return {
        parcelaNumero,
        tipoNombre: tipoNombreExcel || undefined,
        tipoConsumoId: tipoNombreExcel ? undefined : (esTodos ? undefined : tipo),
        periodo: periodoExcel || periodo,
        lecturaActual,
        lecturaAnterior,
        observaciones,
      };
    }).filter((r) => r.parcelaNumero && r.lecturaActual > 0);

    if (data.length === 0) { toast.error("El archivo no tiene datos válidos o las lecturas son 0"); return; }

    toast.promise(importarExcelConsumos(data), {
      loading: `Importando ${data.length} lecturas...`,
      success: (res: Record<string, unknown>) => {
        if (res.error) throw new Error(res.error as string);
        startTransition(() => router.refresh());
        const d = res as unknown as { ok: number; errores: string[] };
        const errMsg = d.errores?.length ? ` (${d.errores.length} errores: ${d.errores.slice(0, 2).join(", ")})` : "";
        return `${d.ok} lecturas importadas correctamente${errMsg}`;
      },
      error: "Error al importar",
    });

    e.target.value = "";
  }

  const estadoChip = (estado: string) => {
    if (estado === "PAGADO") return <span className="chip-confirmed">Pagado</span>;
    if (estado === "PAGO_INFORMADO") return <span className="chip-warning">Informado</span>;
    if (estado === "CON_ESTADO_CUENTA") return <span className="chip-pending">Con EC</span>;
    return <span className="chip-pending">Pendiente</span>;
  };

  // ─── Vista plana cuando tipo = "todos" ────────────────────────────────
  // Genera una fila por cada combinación parcela × tipo de consumo
  const TablaResumen = () => {
    // Construye las filas: para cada parcela, una fila por cada tipoConsumo
    const filas: {
      parcelaId: string;
      parcelaNumero: string;
      parcelaNombre: string;
      t: TipoConsumo;
      consumo: ConsumoRow | undefined;
      rowKey: string;
    }[] = [];

    for (const p of parcelas) {
      for (const t of tiposConsumo) {
        filas.push({
          parcelaId: p.id,
          parcelaNumero: p.numero,
          parcelaNombre: p.nombre,
          t,
          consumo: p.consumos.find((c) => c.tipoConsumoId === t.id),
          rowKey: `${p.id}-${t.id}`,
        });
      }
    }

    async function handleGuardarFila(parcelaId: string, tipoConsumoId: string) {
      const key = `${parcelaId}-${tipoConsumoId}`;
      const lectura = lecturas[key];
      if (!lectura) { toast.error("Ingresa una lectura"); return; }

      setSavingId(key);
      const fd = new FormData();
      fd.set("parcelaId", parcelaId);
      fd.set("tipoConsumoId", tipoConsumoId);
      fd.set("periodo", periodo);
      fd.set("lecturaActual", lectura);

      const result = await guardarLectura(fd);
      setSavingId(null);
      if (!result.success) { toast.error(result.error); return; }

      toast.success("Lectura guardada");
      setLecturas((prev) => { const next = { ...prev }; delete next[key]; return next; });
      startTransition(() => router.refresh());
    }

    return (
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm data-table">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Unidad</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Tipo</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Lect. Anterior</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Nueva Lectura</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Consumo</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Monto Est.</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filas.map(({ parcelaId, parcelaNumero, parcelaNombre, t, consumo, rowKey }) => {
                const hasLectura = consumo && (t.esVariable ? consumo.lecturaActual > 0 : consumo.totalAPagar > 0);
                const inputKey = rowKey;

                return (
                  <tr key={rowKey}>
                    <td className="py-3 px-4 font-semibold rounded-l-lg" style={{ color: "var(--on-surface)" }}>
                      {parcelaNumero}
                      {parcelaNombre && (
                        <span className="block text-xs font-normal" style={{ color: "var(--on-surface-muted)" }}>
                          {parcelaNombre}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium" style={{ color: "var(--on-surface-muted)" }}>
                      {t.nombre}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: "var(--on-surface-muted)" }}>
                      {t.esVariable && hasLectura && consumo
                        ? renderCeldaLectura(rowKey, consumo, "anterior")
                        : <span style={{ color: "var(--on-surface-muted)" }}>—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {t.esVariable ? (
                        hasLectura && consumo ? (
                          renderCeldaLectura(rowKey, consumo, "actual")
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={lecturas[inputKey] ?? ""}
                            onChange={(e) => setLecturas((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                            className="w-28 text-center px-2 py-1.5 text-sm rounded-lg"
                            style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                          />
                        )
                      ) : (
                        <span style={{ color: "var(--on-surface-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: "var(--on-surface)" }}>
                      {t.esVariable && hasLectura ? `${consumo.consumoCalculado.toFixed(2)} ${t.unidadMedida}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold" style={{ color: "var(--on-surface)" }}>
                      {hasLectura ? formatCLP(consumo.totalAPagar) : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {hasLectura ? estadoChip(consumo.estado) : <span className="chip-pending">Pendiente</span>}
                    </td>
                    <td className="py-3 px-4 text-right rounded-r-lg">
                      {t.esVariable && !hasLectura && (
                        <button
                          onClick={() => handleGuardarFila(parcelaId, t.id)}
                          disabled={savingId === inputKey || !lecturas[inputKey]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto transition-opacity disabled:opacity-40"
                          style={{ background: "var(--primary)", color: "white" }}
                        >
                          {savingId === inputKey ? "..." : <><Check size={12} /> Guardar</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Vista detalle por tipo ────────────────────────────────────────────
  const TablaDetalle = () => (
    <div className="card-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm data-table">
          <thead>
            <tr>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Unidad</th>
              <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Lect. Anterior</th>
              <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Nueva Lectura</th>
              <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Consumo</th>
              <th className="text-right py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Monto Est.</th>
              <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {parcelas.map((parcela) => {
              const consumo = parcela.consumos.find((c) => c.tipoConsumoId === tipo);
              const hasLectura = consumo && (tipoActual?.esVariable ? consumo.lecturaActual > 0 : consumo.totalAPagar > 0);

              return (
                <tr key={parcela.id}>
                  <td className="py-3 px-4 font-semibold rounded-l-lg" style={{ color: "var(--on-surface)" }}>
                    {parcela.numero}
                    {parcela.nombre && (
                      <span className="block text-xs font-normal" style={{ color: "var(--on-surface-muted)" }}>
                        {parcela.nombre}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right" style={{ color: "var(--on-surface-muted)" }}>
                    {tipoActual?.esVariable && hasLectura && consumo
                      ? renderCeldaLectura(parcela.id, consumo, "anterior")
                      : <span style={{ color: "var(--on-surface-muted)" }}>—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {tipoActual?.esVariable ? (
                      hasLectura && consumo ? (
                        renderCeldaLectura(parcela.id, consumo, "actual")
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={lecturas[parcela.id] ?? ""}
                          onChange={(e) => setLecturas((prev) => ({ ...prev, [parcela.id]: e.target.value }))}
                          className="w-28 text-center px-2 py-1.5 text-sm rounded-lg"
                          style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                        />
                      )
                    ) : (
                      <span style={{ color: "var(--on-surface-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right" style={{ color: "var(--on-surface)" }}>
                    {tipoActual?.esVariable && hasLectura ? `${consumo.consumoCalculado.toFixed(2)} ${tipoActual.unidadMedida}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold" style={{ color: "var(--on-surface)" }}>
                    {hasLectura ? formatCLP(consumo.totalAPagar) : "—"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {hasLectura ? estadoChip(consumo.estado) : <span className="chip-pending">Pendiente</span>}
                  </td>
                  <td className="py-3 px-4 text-right rounded-r-lg">
                    {tipoActual?.esVariable && !hasLectura && (
                      <button
                        onClick={() => handleGuardar(parcela.id)}
                        disabled={savingId === parcela.id || !lecturas[parcela.id]}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto transition-opacity disabled:opacity-40"
                        style={{ background: "var(--primary)", color: "white" }}
                      >
                        {savingId === parcela.id ? "..." : <><Check size={12} /> Guardar</>}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-end gap-4">

          {/* Unidad (parcela) */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Unidad
            </label>
            <select
              value={parcela}
              onChange={(e) => { setParcela(e.target.value); navigate(tipo, periodo, e.target.value); }}
              className="px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            >
              <option value="todas">Todas</option>
              {todasParcelas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero}{p.nombre ? ` — ${p.nombre}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Tipo de Consumo
            </label>
            <select
              value={tipo}
              onChange={(e) => { setTipo(e.target.value); navigate(e.target.value, periodo, parcela); }}
              className="px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            >
              <option value="todos">Todos</option>
              {tiposConsumo.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          {/* Período */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Período
            </label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => { setPeriodo(e.target.value); navigate(tipo, e.target.value, parcela); }}
              className="px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            />
          </div>

          {/* Plantilla */}
          <button
            onClick={handleDescargarPlantilla}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            title="Descarga un Excel pre-completado con todas las parcelas y tipos variables"
          >
            <Download size={14} />
            Plantilla
          </button>

          {/* Excel import */}
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}>
            <Upload size={14} />
            Importar Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcel} />
          </label>

          {/* Progress */}
          <div className="ml-auto text-right">
            <p className="text-xs font-semibold" style={{ color: "var(--on-surface-muted)" }}>
              ESTADO DE CARGA
            </p>
            <p className="text-2xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
              {progreso.registradas}/{progreso.total}
            </p>
            <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-low)", width: 120 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: "var(--primary)" }}
              />
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-muted)" }}>
              {pct}% completado
            </p>
          </div>
        </div>
      </div>

      {esTodos ? <TablaResumen /> : <TablaDetalle />}
    </div>
  );
}
