import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatCLP, toDecimal } from "@/lib/utils";
import { IngresosEgresosChart, DeudaPieChart } from "./reportes-charts";
import { subMonths, startOfMonth } from "date-fns";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Reportes" };

async function getReportesData() {
  const hoy = new Date();

  // Últimos 6 meses para gráfico ingresos/egresos
  const meses6 = Array.from({ length: 6 }, (_, i) => subMonths(hoy, 5 - i));

  const [
    parcelasStats,
    fondoBalance,
    topDeudores,
    consumosResumen,
    pagosPorEstado,
    gastosCategoria,
  ] = await Promise.all([
    prisma.parcela.aggregate({
      where: { estado: "ACTIVA" },
      _count: { id: true },
      _sum: { deudaAgua: true, deudaLuz: true, deudaGc: true, deudaTotal: true },
    }),
    prisma.fondoCondominio.groupBy({
      by: ["tipo"],
      _sum: { monto: true },
    }),
    prisma.parcela.findMany({
      where: { estado: "ACTIVA", deudaTotal: { gt: 0 } },
      include: { propietario: true },
      orderBy: { deudaTotal: "desc" },
      take: 10,
    }),
    prisma.tipoConsumo.findMany({
      include: {
        consumos: {
          select: { montoConsumo: true, cargoFijo: true, totalAPagar: true, pagado: true },
        },
      },
      orderBy: { orden: "asc" },
    }),
    prisma.pago.groupBy({
      by: ["estado"],
      _count: { id: true },
      _sum: { monto: true },
    }),
    prisma.gastoCondominio.groupBy({
      by: ["categoria"],
      _sum: { monto: true },
      _count: { id: true },
      orderBy: { _sum: { monto: "desc" } },
    }),
  ]);

  // Ingresos y egresos por mes
  const ingresosEgresosChart = await Promise.all(
    meses6.map(async (mes) => {
      const inicio = startOfMonth(mes);
      const fin = startOfMonth(subMonths(mes, -1));
      const [ingresos, egresos] = await Promise.all([
        prisma.fondoCondominio.aggregate({
          where: { tipo: "INGRESO", fecha: { gte: inicio, lt: fin } },
          _sum: { monto: true },
        }),
        prisma.fondoCondominio.aggregate({
          where: { tipo: "EGRESO", fecha: { gte: inicio, lt: fin } },
          _sum: { monto: true },
        }),
      ]);
      return {
        mes: mes.toLocaleDateString("es-CL", { month: "short" }).toUpperCase(),
        ingresos: toDecimal(ingresos._sum.monto),
        egresos: toDecimal(egresos._sum.monto),
      };
    })
  );

  const totalIngresos = toDecimal(fondoBalance.find((f) => f.tipo === "INGRESO")?._sum.monto);
  const totalEgresos = toDecimal(fondoBalance.find((f) => f.tipo === "EGRESO")?._sum.monto);
  const balance = totalIngresos - totalEgresos;

  const parcelasTotal = parcelasStats._count.id;
  const deudaTotal = toDecimal(parcelasStats._sum.deudaTotal);
  const deudaAgua = toDecimal(parcelasStats._sum.deudaAgua);
  const deudaLuz = toDecimal(parcelasStats._sum.deudaLuz);
  const deudaGc = toDecimal(parcelasStats._sum.deudaGc);

  const parcelasEnMora = topDeudores.length; // total con deuda > 0
  const parcelasAlDia = parcelasTotal - parcelasEnMora;

  const deudaPieData = [
    { name: "Agua", value: deudaAgua, color: "#2196f3" },
    { name: "Luz", value: deudaLuz, color: "#ff9800" },
    { name: "Gasto Común", value: deudaGc, color: "var(--primary)" },
  ].filter((d) => d.value > 0);

  const pagosAprobados = pagosPorEstado.find((p) => p.estado === "APROBADO");
  const pagosPendientes = pagosPorEstado.find((p) => p.estado === "PENDIENTE");

  return {
    balance,
    totalIngresos,
    totalEgresos,
    parcelasTotal,
    parcelasAlDia,
    parcelasEnMora,
    deudaTotal,
    deudaAgua,
    deudaLuz,
    deudaGc,
    deudaPieData,
    ingresosEgresosChart,
    topDeudores: topDeudores.map((p) => ({
      numero: p.numero,
      nombre: p.nombre,
      propietario: p.propietario
        ? `${p.propietario.firstName} ${p.propietario.lastName}`.trim() || p.propietario.username
        : null,
      deudaTotal: toDecimal(p.deudaTotal),
      deudaAgua: toDecimal(p.deudaAgua),
      deudaLuz: toDecimal(p.deudaLuz),
      deudaGc: toDecimal(p.deudaGc),
    })),
    consumosResumen: consumosResumen.map((t) => ({
      nombre: t.nombre,
      color: t.color,
      totalFacturado: t.consumos.reduce((s, c) => s + toDecimal(c.totalAPagar), 0),
      totalPagado: t.consumos.filter((c) => c.pagado).reduce((s, c) => s + toDecimal(c.totalAPagar), 0),
      count: t.consumos.length,
    })),
    pagosAprobadosCount: pagosAprobados?._count.id ?? 0,
    pagosAprobadosMonto: toDecimal(pagosAprobados?._sum.monto),
    pagosPendientesCount: pagosPendientes?._count.id ?? 0,
    gastosCategoria: gastosCategoria.map((g) => ({
      categoria: g.categoria,
      monto: toDecimal(g._sum.monto),
      count: g._count.id,
    })),
  };
}

const CATEGORIA_LABEL: Record<string, string> = {
  MANTENIMIENTO: "Mantenimiento",
  SERVICIOS: "Servicios",
  SERVICIOS_PUBLICOS: "Servicios Públicos",
  REPARACION: "Reparación",
  OTRO: "Otro",
};

export default async function ReportesPage() {
  const data = await getReportesData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Reportes
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Resumen financiero y estadísticas del condominio.
        </p>
      </div>

      {/* KPIs financieros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
            Balance del Fondo
          </p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: data.balance >= 0 ? "var(--tertiary)" : "var(--error)" }}>
            {formatCLP(data.balance)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            {data.balance >= 0
              ? <TrendingUp size={12} style={{ color: "var(--tertiary)" }} />
              : <TrendingDown size={12} style={{ color: "var(--error)" }} />}
            <span className="text-xs" style={{ color: "var(--on-surface-muted)" }}>
              {formatCLP(data.totalIngresos)} ing. · {formatCLP(data.totalEgresos)} egr.
            </span>
          </div>
        </div>

        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
            Deuda Total Pendiente
          </p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: data.deudaTotal > 0 ? "var(--error)" : "var(--on-surface)" }}>
            {formatCLP(data.deudaTotal)}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--on-surface-muted)" }}>
            {data.parcelasEnMora} parcela{data.parcelasEnMora !== 1 ? "s" : ""} en mora
          </p>
        </div>

        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
            Cumplimiento
          </p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: "var(--on-surface)" }}>
            {data.parcelasTotal > 0 ? Math.round((data.parcelasAlDia / data.parcelasTotal) * 100) : 0}%
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--on-surface-muted)" }}>
            {data.parcelasAlDia} de {data.parcelasTotal} al día
          </p>
        </div>
      </div>

      {/* Gráfico ingresos vs egresos + desglose deuda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-surface p-6">
          <h2 className="text-base font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
            Ingresos vs Egresos (últimos 6 meses)
          </h2>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "var(--tertiary)" }} />
              <span className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Ingresos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "var(--error)" }} />
              <span className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Egresos</span>
            </div>
          </div>
          <IngresosEgresosChart data={data.ingresosEgresosChart} />
        </div>

        <div className="card-surface p-6">
          <h2 className="text-base font-semibold font-display mb-1" style={{ color: "var(--on-surface)" }}>
            Composición de Deuda
          </h2>
          {data.deudaPieData.length > 0 ? (
            <DeudaPieChart data={data.deudaPieData} />
          ) : (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "var(--tertiary)" }} />
                <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>Sin deuda pendiente</p>
              </div>
            </div>
          )}
          {data.deudaPieData.length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: "#2196f3" }}>Agua</span>
                <span className="font-medium" style={{ color: "var(--on-surface)" }}>{formatCLP(data.deudaAgua)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#ff9800" }}>Luz</span>
                <span className="font-medium" style={{ color: "var(--on-surface)" }}>{formatCLP(data.deudaLuz)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--primary)" }}>Gasto Común</span>
                <span className="font-medium" style={{ color: "var(--on-surface)" }}>{formatCLP(data.deudaGc)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top deudores + Gastos por categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top deudores */}
        <div className="card-surface p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} style={{ color: "var(--error)" }} />
            <h2 className="text-base font-semibold font-display" style={{ color: "var(--on-surface)" }}>
              Parcelas con Mayor Deuda
            </h2>
          </div>
          {data.topDeudores.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--on-surface-muted)" }}>
              No hay parcelas en mora.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topDeudores.map((p) => (
                <div key={p.numero} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "var(--surface-low)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>
                      Parcela {p.numero}
                      {p.nombre && <span className="font-normal text-xs ml-1" style={{ color: "var(--on-surface-muted)" }}>· {p.nombre}</span>}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--on-surface-muted)" }}>
                      {p.propietario || "Sin propietario"}
                    </p>
                  </div>
                  <span className="text-sm font-bold ml-3 flex-shrink-0" style={{ color: "var(--error)" }}>
                    {formatCLP(p.deudaTotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gastos por categoría */}
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
            Gastos por Categoría
          </h2>
          {data.gastosCategoria.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--on-surface-muted)" }}>
              Sin gastos registrados.
            </p>
          ) : (
            <div className="space-y-3">
              {data.gastosCategoria.map((g) => {
                const maxMonto = Math.max(...data.gastosCategoria.map((x) => x.monto));
                const pct = maxMonto > 0 ? (g.monto / maxMonto) * 100 : 0;
                return (
                  <div key={g.categoria}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "var(--on-surface)" }}>{CATEGORIA_LABEL[g.categoria] ?? g.categoria}</span>
                      <span className="font-medium" style={{ color: "var(--on-surface)" }}>{formatCLP(g.monto)}</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: "var(--surface-low)" }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: "var(--primary)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Resumen consumos + pagos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumos por tipo */}
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
            Consumos por Tipo
          </h2>
          {data.consumosResumen.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--on-surface-muted)" }}>Sin consumos registrados.</p>
          ) : (
            <div className="space-y-4">
              {data.consumosResumen.map((c) => {
                const pctPagado = c.totalFacturado > 0 ? (c.totalPagado / c.totalFacturado) * 100 : 0;
                return (
                  <div key={c.nombre}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>{c.nombre}</span>
                      <span className="text-xs" style={{ color: "var(--on-surface-muted)" }}>
                        {formatCLP(c.totalPagado)} / {formatCLP(c.totalFacturado)}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: "var(--surface-low)" }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pctPagado}%`, background: c.color }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-muted)" }}>
                      {pctPagado.toFixed(0)}% cobrado · {c.count} registros
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumen pagos */}
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
            Resumen de Pagos
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{ background: "var(--tertiary-container)" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--tertiary)" }}>Aprobados</p>
                <p className="text-xl font-bold font-display" style={{ color: "var(--tertiary)" }}>
                  {data.pagosAprobadosCount}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--tertiary)" }}>Total recaudado</p>
                <p className="text-sm font-bold" style={{ color: "var(--tertiary)" }}>{formatCLP(data.pagosAprobadosMonto)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{ background: "var(--surface-low)" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>Pendientes</p>
                <p className="text-xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
                  {data.pagosPendientesCount}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>por validar</p>
                <a href="/admin/validacion" className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                  Ir a validación →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
