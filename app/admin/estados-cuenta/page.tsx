import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { EstadosCuentaClient } from "./estados-cuenta-client";
import { format, startOfMonth } from "date-fns";

export const metadata: Metadata = { title: "Estados de Cuenta" };

export default async function EstadosCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const hoy = new Date();
  const fallbackPeriodo = format(startOfMonth(hoy), "yyyy-MM");
  const periodoRaw = params.periodo || fallbackPeriodo;
  const periodoParam = /^20\d{2}-(0[1-9]|1[0-2])$/.test(periodoRaw) ? periodoRaw : fallbackPeriodo;
  const periodo = new Date(periodoParam + "-01");

  const [estadosCuenta, parcelas] = await Promise.all([
    prisma.estadoCuenta.findMany({
      where: { periodo },
      include: {
        parcela: { include: { propietario: true } },
        consumos: { include: { tipoConsumo: true } },
      },
      orderBy: { parcela: { numero: "asc" } },
    }),
    prisma.parcela.findMany({
      where: { estado: "ACTIVA" },
      include: {
        consumos: {
          where: { periodo, estado: "PENDIENTE" },
          include: { tipoConsumo: true },
        },
      },
      orderBy: { numero: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Estados de Cuenta
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Genera y envía los estados de cuenta mensuales a los propietarios.
        </p>
      </div>

      <EstadosCuentaClient
        periodoActual={periodoParam}
        estadosCuenta={estadosCuenta.map((ec) => ({
          id: ec.id,
          parcelaId: ec.parcelaId,
          parcelaNumero: ec.parcela.numero,
          propietario: ec.parcela.propietario
            ? `${ec.parcela.propietario.firstName} ${ec.parcela.propietario.lastName}`.trim() || ec.parcela.propietario.username
            : null,
          email: ec.parcela.propietario?.email || null,
          subtotalAgua: Number(ec.subtotalAgua),
          subtotalLuz: Number(ec.subtotalLuz),
          subtotalGc: Number(ec.subtotalGc),
          deudaAnterior: Number(ec.deudaAnterior),
          total: Number(ec.total),
          estado: ec.estado,
          fechaEmision: ec.fechaEmision?.toISOString() || null,
        }))}
        parcelasSinEc={parcelas
          .filter(p => p.consumos.length > 0 && !estadosCuenta.find(ec => ec.parcelaId === p.id))
          .map(p => ({
            id: p.id,
            numero: p.numero,
            consumoCount: p.consumos.length,
          }))}
      />
    </div>
  );
}
