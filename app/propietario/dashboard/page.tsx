export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCLP, formatPeriodo, formatPeriodoCorto, toDecimal } from "@/lib/utils";
import { ConsumoCharts } from "./consumo-charts";
import { redirect } from "next/navigation";
import { startOfMonth, subMonths } from "date-fns";
import { AlertTriangle, Download } from "lucide-react";
import { ParcelaSelector } from "@/app/propietario/_components/parcela-selector";

export const metadata: Metadata = { title: "Mi Dashboard" };

async function getPropietarioData(parcelaId: string) {
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: { propietario: true },
  });

  if (!parcela) return null;

  const hoy = new Date();
  const meses5 = Array.from({ length: 5 }, (_, i) => startOfMonth(subMonths(hoy, 4 - i)));

  const tiposConsumo = await prisma.tipoConsumo.findMany({ where: { activo: true } });
  const tipoAgua = tiposConsumo.find((t) => t.nombre.toLowerCase() === "agua");
  const tipoLuz = tiposConsumo.find((t) => t.nombre.toLowerCase() === "luz");

  const consumos5meses = await prisma.consumoMensual.findMany({
    where: {
      parcelaId,
      periodo: { gte: meses5[0] },
    },
    include: { tipoConsumo: true },
    orderBy: { periodo: "asc" },
  });

  // Armar data para gráficos
  const chartData = meses5.map((mes) => {
    const label = formatPeriodoCorto(mes);
    const agua = consumos5meses.find(
      (c) => c.tipoConsumoId === tipoAgua?.id && c.periodo.getMonth() === mes.getMonth() && c.periodo.getFullYear() === mes.getFullYear()
    );
    const luz = consumos5meses.find(
      (c) => c.tipoConsumoId === tipoLuz?.id && c.periodo.getMonth() === mes.getMonth() && c.periodo.getFullYear() === mes.getFullYear()
    );
    return {
      mes: label,
      agua: toDecimal(agua?.consumoCalculado),
      luz: toDecimal(luz?.consumoCalculado),
    };
  });

  // Último consumo agua y luz para el KPI
  const ultimoAgua = consumos5meses
    .filter((c) => c.tipoConsumoId === tipoAgua?.id)
    .sort((a, b) => b.periodo.getTime() - a.periodo.getTime())[0];

  const ultimoLuz = consumos5meses
    .filter((c) => c.tipoConsumoId === tipoLuz?.id)
    .sort((a, b) => b.periodo.getTime() - a.periodo.getTime())[0];

  // Variación agua vs período anterior
  const variacionAgua = (() => {
    const aguaArr = consumos5meses.filter((c) => c.tipoConsumoId === tipoAgua?.id).sort((a, b) => b.periodo.getTime() - a.periodo.getTime());
    if (aguaArr.length >= 2) {
      const actual = toDecimal(aguaArr[0].consumoCalculado);
      const anterior = toDecimal(aguaArr[1].consumoCalculado);
      if (anterior > 0) return ((actual - anterior) / anterior) * 100;
    }
    return 0;
  })();

  const variacionLuz = (() => {
    const luzArr = consumos5meses.filter((c) => c.tipoConsumoId === tipoLuz?.id).sort((a, b) => b.periodo.getTime() - a.periodo.getTime());
    if (luzArr.length >= 2) {
      const actual = toDecimal(luzArr[0].consumoCalculado);
      const anterior = toDecimal(luzArr[1].consumoCalculado);
      if (anterior > 0) return ((actual - anterior) / anterior) * 100;
    }
    return 0;
  })();

  // Historial de pagos
  const pagos = await prisma.pago.findMany({
    where: { parcelaId },
    orderBy: { creado: "desc" },
    take: 10,
  });

  // Estados de cuenta
  const estadosCuenta = await prisma.estadoCuenta.findMany({
    where: { parcelaId },
    orderBy: { periodo: "desc" },
    take: 6,
  });

  return {
    parcela: {
      id: parcela.id,
      numero: parcela.numero,
      nombre: parcela.nombre,
      deudaTotal: toDecimal(parcela.deudaTotal),
      deudaAgua: toDecimal(parcela.deudaAgua),
      deudaLuz: toDecimal(parcela.deudaLuz),
      deudaGc: toDecimal(parcela.deudaGc),
    },
    ultimoAgua: ultimoAgua ? {
      consumo: toDecimal(ultimoAgua.consumoCalculado),
      unidad: tipoAgua?.unidadMedida || "m³",
    } : null,
    ultimoLuz: ultimoLuz ? {
      consumo: toDecimal(ultimoLuz.consumoCalculado),
      unidad: tipoLuz?.unidadMedida || "kWh",
    } : null,
    variacionAgua,
    variacionLuz,
    chartData,
    pagos: pagos.map((p) => ({
      id: p.id,
      monto: toDecimal(p.monto),
      periodo: p.concepto || "—",
      estado: p.estado,
      creado: p.creado.toISOString(),
    })),
    estadosCuenta: estadosCuenta.map((ec) => ({
      id: ec.id,
      periodo: ec.periodo.toISOString(),
      total: toDecimal(ec.total),
      estado: ec.estado,
      pdf: ec.pdf,
    })),
  };
}

export default async function PropietarioDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ parcela?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const resolvedSearchParams = await searchParams;

  // Obtener TODAS las parcelas del propietario
  const parcelas = await prisma.parcela.findMany({
    where: { propietarioId: session.user.id, estado: "ACTIVA" },
    select: { id: true, numero: true, nombre: true },
  });

  if (parcelas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle size={40} style={{ color: "var(--on-surface-muted)" }} />
        <h2 className="text-xl font-bold font-display mt-4" style={{ color: "var(--on-surface)" }}>
          Sin parcela asignada
        </h2>
        <p className="text-sm mt-2" style={{ color: "var(--on-surface-muted)" }}>
          Contacta al administrador para asignar tu propiedad.
        </p>
      </div>
    );
  }

  // Determinar parcela seleccionada
  const selectedParcelaId = resolvedSearchParams.parcela && parcelas.some(p => p.id === resolvedSearchParams.parcela)
    ? resolvedSearchParams.parcela
    : parcelas[0].id;

  const data = await getPropietarioData(selectedParcelaId);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle size={40} style={{ color: "var(--on-surface-muted)" }} />
        <h2 className="text-xl font-bold font-display mt-4" style={{ color: "var(--on-surface)" }}>
          Parcela no encontrada
        </h2>
        <p className="text-sm mt-2" style={{ color: "var(--on-surface-muted)" }}>
          La parcela seleccionada no está disponible.
        </p>
      </div>
    );
  }

  const nombre = session.user.name?.split(" ")[0] || "Propietario";
  const parcelaParam = `?parcela=${selectedParcelaId}`;

  const estadoPagoChip = (estado: string) => {
    if (estado === "APROBADO") return <span className="chip-confirmed">Pagado</span>;
    if (estado === "RECHAZADO") return <span className="chip-error">Rechazado</span>;
    if (estado === "PENDIENTE") return <span className="chip-pending">Pendiente</span>;
    return <span className="chip-warning">Anulado</span>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
            Hola, {nombre} 👋
          </h1>
          <ParcelaSelector parcelas={parcelas} />
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Parcela {data.parcela.numero}
          {data.parcela.nombre && ` — ${data.parcela.nombre}`}
        </p>
      </div>

      {/* Deuda + Consumos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deuda actual */}
        <div
          className="rounded-2xl p-6 text-white"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Deuda Actual</p>
          <p className="text-3xl font-bold font-display mt-2">
            {formatCLP(data.parcela.deudaTotal)}
          </p>
          {data.parcela.deudaTotal > 0 && (
            <div className="mt-4 space-y-1.5">
              {data.parcela.deudaAgua > 0 && (
                <div className="flex justify-between text-xs opacity-80">
                  <span>Agua</span>
                  <span>{formatCLP(data.parcela.deudaAgua)}</span>
                </div>
              )}
              {data.parcela.deudaLuz > 0 && (
                <div className="flex justify-between text-xs opacity-80">
                  <span>Luz</span>
                  <span>{formatCLP(data.parcela.deudaLuz)}</span>
                </div>
              )}
              {data.parcela.deudaGc > 0 && (
                <div className="flex justify-between text-xs opacity-80">
                  <span>Gasto Común</span>
                  <span>{formatCLP(data.parcela.deudaGc)}</span>
                </div>
              )}
            </div>
          )}
          <div className="mt-5 space-y-2">
            <a
              href={`/propietario/informar-pago${parcelaParam}`}
              className="block text-center py-2.5 rounded-xl text-sm font-semibold bg-white"
              style={{ color: "var(--primary)" }}
            >
              Informar Pago
            </a>
            <a
              href={`/propietario/estados-cuenta${parcelaParam}`}
              className="block text-center py-2.5 rounded-xl text-sm font-semibold border border-white/30"
              style={{ color: "white" }}
            >
              Ver Detalle Completo
            </a>
          </div>
        </div>

        {/* Agua */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
                Consumo de Agua
              </p>
              {data.ultimoAgua && (
                <p className="text-lg font-bold font-display mt-1" style={{ color: "var(--on-surface)" }}>
                  {data.ultimoAgua.consumo.toFixed(1)} {data.ultimoAgua.unidad}
                </p>
              )}
            </div>
            {data.variacionAgua !== 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: data.variacionAgua < 0 ? "var(--tertiary-container)" : "var(--error-container)",
                  color: data.variacionAgua < 0 ? "var(--tertiary)" : "var(--error)",
                }}
              >
                {data.variacionAgua > 0 ? "+" : ""}{data.variacionAgua.toFixed(1)}% vs mes ant.
              </span>
            )}
          </div>
          <ConsumoCharts data={data.chartData} tipo="agua" color="var(--primary)" />
        </div>

        {/* Luz */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
                Consumo de Luz
              </p>
              {data.ultimoLuz && (
                <p className="text-lg font-bold font-display mt-1" style={{ color: "var(--on-surface)" }}>
                  {data.ultimoLuz.consumo.toFixed(1)} {data.ultimoLuz.unidad}
                </p>
              )}
            </div>
            {data.variacionLuz !== 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: data.variacionLuz < 0 ? "var(--tertiary-container)" : "var(--warning-container)",
                  color: data.variacionLuz < 0 ? "var(--tertiary)" : "var(--warning)",
                }}
              >
                {data.variacionLuz > 0 ? "+" : ""}{data.variacionLuz.toFixed(1)}% vs mes ant.
              </span>
            )}
          </div>
          <ConsumoCharts data={data.chartData} tipo="luz" color="#f59e0b" />
        </div>
      </div>

      {/* Historial + Avisos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historial de cobros */}
        <div className="lg:col-span-2 card-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold font-display" style={{ color: "var(--on-surface)" }}>
              Historial de Últimos Cobros
            </h2>
            <a href={`/propietario/estados-cuenta${parcelaParam}`} className="text-xs" style={{ color: "var(--primary)" }}>
              Ver todo el historial
            </a>
          </div>

          {data.estadosCuenta.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--on-surface-muted)" }}>
              Aún no tienes estados de cuenta emitidos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm data-table">
                <thead>
                  <tr>
                    <th className="text-left py-2.5 px-3 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Mes Período</th>
                    <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Monto Cobrado</th>
                    <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-muted)" }}>Estado</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.estadosCuenta.map((ec) => (
                    <tr key={ec.id}>
                      <td className="py-3 px-3 rounded-l-lg" style={{ color: "var(--on-surface)" }}>
                        {formatPeriodo(ec.periodo)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold" style={{ color: "var(--on-surface)" }}>
                        {formatCLP(ec.total)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {ec.estado === "PAGADO" ? <span className="chip-confirmed">Pagado</span> : <span className="chip-pending">Pendiente</span>}
                      </td>
                      <td className="py-3 px-3 text-right rounded-r-lg">
                        {ec.pdf && (
                          <a href={`/uploads/${ec.pdf}`} target="_blank" rel="noopener noreferrer" title="Descargar PDF">
                            <Download size={14} style={{ color: "var(--primary)" }} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagos recientes */}
        <div className="card-surface p-5">
          <h2 className="text-base font-semibold font-display mb-4" style={{ color: "var(--on-surface)" }}>
            Mis Pagos Recientes
          </h2>
          {data.pagos.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>Sin pagos registrados.</p>
          ) : (
            <div className="space-y-3">
              {data.pagos.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>{formatCLP(p.monto)}</p>
                    <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>{p.periodo || "—"}</p>
                  </div>
                  {estadoPagoChip(p.estado)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
