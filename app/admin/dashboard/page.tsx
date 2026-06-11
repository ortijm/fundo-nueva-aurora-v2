export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCLP, toDecimal } from "@/lib/utils";
import { DashboardCharts } from "./dashboard-charts";
import { PagosPendientesTable } from "./pagos-pendientes-table";
import {
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { subMonths, startOfMonth } from "date-fns";

export const metadata: Metadata = { title: "Dashboard" };

async function getDashboardData() {
  const hoy = new Date();
  const inicioMes = startOfMonth(hoy);
  const inicioMesAnterior = startOfMonth(subMonths(hoy, 1));

  const [
    parcelasStats,
    pagosPendientes,
    pagosAprobadosMes,
    pagosAprobadosMesAnterior,
    consumosMes,
  ] = await Promise.all([
    prisma.parcela.aggregate({
      where: { estado: "ACTIVA" },
      _count: { id: true },
      _sum: { deudaTotal: true },
    }),
    prisma.pago.findMany({
      where: { estado: "PENDIENTE" },
      include: {
        parcela: { include: { propietario: true } },
      },
      orderBy: { creado: "desc" },
      take: 10,
    }),
    prisma.pago.aggregate({
      where: { estado: "APROBADO", fechaAprobacion: { gte: inicioMes } },
      _sum: { monto: true },
      _count: { id: true },
    }),
    prisma.pago.aggregate({
      where: {
        estado: "APROBADO",
        fechaAprobacion: { gte: inicioMesAnterior, lt: inicioMes },
      },
      _sum: { monto: true },
    }),
    prisma.consumoMensual.aggregate({
      where: { periodo: { gte: inicioMes } },
      _count: { id: true },
    }),
  ]);

  // Parcelas al día vs en mora
  const parcelasActivas = parcelasStats._count.id;
  const parcelasEnMora = await prisma.parcela.count({
    where: { estado: "ACTIVA", deudaTotal: { gt: 0 } },
  });
  const parcelasAlDia = parcelasActivas - parcelasEnMora;

  const recaudadoMes = toDecimal(pagosAprobadosMes._sum.monto);
  const recaudadoMesAnterior = toDecimal(pagosAprobadosMesAnterior._sum.monto);
  const variacionPct =
    recaudadoMesAnterior > 0
      ? ((recaudadoMes - recaudadoMesAnterior) / recaudadoMesAnterior) * 100
      : 0;

  const cumplimientoPct =
    parcelasActivas > 0
      ? Math.round((parcelasAlDia / parcelasActivas) * 100)
      : 0;

  // Ingresos últimos 6 meses
  const meses6 = Array.from({ length: 6 }, (_, i) => subMonths(hoy, 5 - i));
  const ingresosChart = await Promise.all(
    meses6.map(async (mes) => {
      const inicio = startOfMonth(mes);
      const fin = startOfMonth(subMonths(mes, -1));
      const agg = await prisma.pago.aggregate({
        where: { estado: "APROBADO", fechaAprobacion: { gte: inicio, lt: fin } },
        _sum: { monto: true },
      });
      return {
        mes: mes.toLocaleDateString("es-CL", { month: "short" }).toUpperCase(),
        monto: toDecimal(agg._sum.monto),
      };
    })
  );

  return {
    parcelasActivas,
    parcelasAlDia,
    parcelasEnMora,
    deudaTotal: toDecimal(parcelasStats._sum.deudaTotal),
    recaudadoMes,
    variacionPct,
    cumplimientoPct,
    pagosPendientes: pagosPendientes.map((p) => ({
      id: p.id,
      parcelaNumero: p.parcela.numero,
      propietario: p.parcela.propietario
        ? `${p.parcela.propietario.firstName} ${p.parcela.propietario.lastName}`.trim() || p.parcela.propietario.username
        : null,
      monto: toDecimal(p.monto),
      fechaOperacion: p.fechaOperacion.toISOString(),
      estado: p.estado,
    })),
    ingresosChart,
    consumosMes: consumosMes._count.id,
  };
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const data = await getDashboardData();
  const nombre = session?.user.name?.split(" ")[0] || "Admin";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Resumen Ejecutivo
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Bienvenido, {nombre}. Aquí está el estado actual del Condominio.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recaudación del mes */}
        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
            Recaudación del Mes
          </p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: "var(--on-surface)" }}>
            {formatCLP(data.recaudadoMes)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp size={12} style={{ color: data.variacionPct >= 0 ? "var(--tertiary)" : "var(--error)" }} />
            <span className="text-xs font-medium" style={{ color: data.variacionPct >= 0 ? "var(--tertiary)" : "var(--error)" }}>
              {data.variacionPct >= 0 ? "+" : ""}{data.variacionPct.toFixed(1)}% vs mes anterior
            </span>
          </div>
        </div>

        {/* Cumplimiento */}
        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
            Cumplimiento
          </p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: "var(--on-surface)" }}>
            {data.cumplimientoPct}%
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--on-surface-muted)" }}>
            {data.parcelasAlDia} de {data.parcelasActivas} al día
          </p>
        </div>

        {/* Morosas */}
        <div className="card-surface p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
                Morosas
              </p>
              <p className="text-2xl font-bold font-display mt-2" style={{ color: data.parcelasEnMora > 0 ? "var(--error)" : "var(--on-surface)" }}>
                {data.parcelasEnMora}
              </p>
              <p className="text-xs mt-2" style={{ color: "var(--on-surface-muted)" }}>
                {formatCLP(data.deudaTotal)} en mora
              </p>
            </div>
            {data.parcelasEnMora > 0 && (
              <AlertTriangle size={20} style={{ color: "var(--error)" }} />
            )}
          </div>
        </div>

        {/* Pagos pendientes */}
        <div className="card-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
            Pagos Pendientes
          </p>
          <p className="text-2xl font-bold font-display mt-2" style={{ color: "var(--on-surface)" }}>
            {data.pagosPendientes.length}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--on-surface-muted)" }}>
            comprobantes por validar
          </p>
        </div>
      </div>

      {/* Charts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold font-display" style={{ color: "var(--on-surface)" }}>
              Tendencia de Ingresos
            </h2>
          </div>
          <DashboardCharts data={data.ingresosChart} />
        </div>

        <div className="space-y-4">
          {/* Gastos comunes */}
          <div className="card-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--on-surface-muted)" }}>
              Gastos Comunes
            </p>
            <p className="text-sm mb-3" style={{ color: "var(--on-surface)" }}>
              Genera el cobro del período actual y notifica a los residentes.
            </p>
            <a
              href="/admin/gastos"
              className="block text-center py-2 px-4 rounded-xl text-sm font-semibold text-white transition-opacity"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
            >
              Generar Gastos
            </a>
          </div>

          {/* Consumos */}
          <div className="card-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--on-surface-muted)" }}>
              Consumos
            </p>
            <p className="text-sm mb-3" style={{ color: "var(--on-surface)" }}>
              Valida lecturas de agua/luz del período.
            </p>
            <a
              href="/admin/consumos"
              className="flex items-center justify-between py-2 px-4 rounded-xl text-sm font-medium"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
            >
              Ir a Consumos
              <span>→</span>
            </a>
          </div>
        </div>
      </div>

      {/* Pagos pendientes */}
      <div className="card-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold font-display" style={{ color: "var(--on-surface)" }}>
            Pagos Pendientes de Validación
          </h2>
          <a
            href="/admin/validacion"
            className="text-xs font-medium"
            style={{ color: "var(--primary)" }}
          >
            Ver todos →
          </a>
        </div>
        <PagosPendientesTable pagos={data.pagosPendientes} />
      </div>
    </div>
  );
}
