import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ConsumosClient } from "./consumos-client";
import { format, startOfMonth } from "date-fns";

export const metadata: Metadata = { title: "Gestión de Consumos" };

export default async function ConsumosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; periodo?: string; parcela?: string }>;
}) {
  const params = await searchParams;
  const hoy = new Date();
  const fallbackPeriodo = format(startOfMonth(hoy), "yyyy-MM");

  // Validar formato yyyy-MM y año razonable (2000–2099)
  const periodoRaw = params.periodo || fallbackPeriodo;
  const periodoValido = /^20\d{2}-(0[1-9]|1[0-2])$/.test(periodoRaw);
  const periodoParam = periodoValido ? periodoRaw : fallbackPeriodo;
  const periodo = new Date(periodoParam + "-01");

  const tipoEsTodos = !params.tipo || params.tipo === "todos";
  const parcelaEsTodas = !params.parcela || params.parcela === "todas";

  const [parcelasData, tiposConsumo, todasParcelas] = await Promise.all([
    prisma.parcela.findMany({
      where: {
        estado: "ACTIVA",
        ...(parcelaEsTodas ? {} : { id: params.parcela }),
      },
      include: {
        propietario: true,
        consumos: {
          where: {
            periodo,
            ...(tipoEsTodos ? {} : { tipoConsumoId: params.tipo }),
          },
          include: { tipoConsumo: true },
        },
      },
      orderBy: { numero: "asc" },
    }),
    prisma.tipoConsumo.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    prisma.parcela.findMany({
      where: { estado: "ACTIVA" },
      select: { id: true, numero: true, nombre: true },
      orderBy: { numero: "asc" },
    }),
  ]);

  // Progreso: considera solo tipos variables (lecturas reales)
  const totalParcelas = parcelasData.length;

  let conLectura: number;
  if (tipoEsTodos) {
    // Tiene al menos un consumo variable registrado en el período
    conLectura = parcelasData.filter((p) =>
      p.consumos.some((c) => c.tipoConsumo.esVariable && Number(c.lecturaActual) > 0)
    ).length;
  } else {
    conLectura = parcelasData.filter((p) =>
      p.consumos.some(
        (c) => c.tipoConsumoId === params.tipo && Number(c.lecturaActual) > 0
      )
    ).length;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Gestión de Consumos
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Registro mensual de lecturas de medidores
        </p>
      </div>

      <ConsumosClient
        parcelas={parcelasData.map((p) => ({
          id: p.id,
          numero: p.numero,
          nombre: p.nombre,
          propietario: p.propietario
            ? `${p.propietario.firstName} ${p.propietario.lastName}`.trim() || p.propietario.username
            : null,
          consumos: p.consumos.map((c) => ({
            id: c.id,
            tipoConsumoId: c.tipoConsumoId,
            tipoNombre: c.tipoConsumo.nombre,
            lecturaAnterior: Number(c.lecturaAnterior),
            lecturaActual: Number(c.lecturaActual),
            consumoCalculado: Number(c.consumoCalculado),
            totalAPagar: Number(c.totalAPagar),
            estado: c.estado,
          })),
        }))}
        tiposConsumo={tiposConsumo.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          unidadMedida: t.unidadMedida,
          esVariable: t.esVariable,
        }))}
        todasParcelas={todasParcelas}
        periodoActual={periodoParam}
        tipoSeleccionado={params.tipo || "todos"}
        parcelaSeleccionada={params.parcela || "todas"}
        progreso={{ total: totalParcelas, registradas: conLectura }}
      />
    </div>
  );
}
