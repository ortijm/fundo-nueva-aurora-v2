import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/services/config";
import { createElement } from "react";
import { EstadoCuentaPDF, type EstadoCuentaData } from "@/lib/pdf/estado-cuenta-pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const ec = await prisma.estadoCuenta.findUnique({
    where: { id },
    include: {
      parcela: { include: { propietario: true } },
      consumos: {
        include: { tipoConsumo: true },
        orderBy: { tipoConsumo: { nombre: "asc" } },
      },
    },
  });

  if (!ec) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Propietarios solo pueden ver sus propios EC
  if (session.user.rol === "PROPIETARIO") {
    if (ec.parcela.propietarioId !== session.user.id) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
  }

  const config = await getConfig();

  const propietario = ec.parcela.propietario;
  const propietarioNombre = propietario
    ? `${propietario.firstName} ${propietario.lastName}`.trim() || propietario.username
    : "Sin propietario";

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const dt = new Date(ec.periodo);
  const periodoLabel = `${meses[dt.getMonth()]} ${dt.getFullYear()}`;

  const data: EstadoCuentaData = {
    id: ec.id,
    parcelaNumero: ec.parcela.numero,
    parcelaNombre: ec.parcela.nombre || null,
    parcelaSector: null,
    propietarioNombre,
    periodoLabel,
    fechaEmision: ec.fechaEmision,
    subtotalAgua: Number(ec.subtotalAgua),
    subtotalLuz: Number(ec.subtotalLuz),
    subtotalGc: Number(ec.subtotalGc),
    deudaAnterior: Number(ec.deudaAnterior),
    total: Number(ec.total),
    consumos: ec.consumos.map((c) => ({
      tipoNombre: c.tipoConsumo.nombre,
      periodo: c.periodo,
      lecturaAnterior: Number(c.lecturaAnterior),
      lecturaActual: Number(c.lecturaActual),
      consumoCalculado: Number(c.consumoCalculado),
      totalAPagar: Number(c.totalAPagar),
      esVariable: c.tipoConsumo.esVariable,
    })),
    nombreCondominio: config.nombreCondominio,
    direccion: config.direccion,
    telefono: config.telefono,
    banco: config.banco,
    tipoCuenta: config.tipoCuenta,
    numeroCuenta: config.numeroCuenta,
    nombreTitular: config.nombreTitular,
    rutTitular: config.rutTitular,
    emailPagos: config.emailPagos,
    mensajePieEc: config.mensajePieEc,
  };

  // Import dinámico — @react-pdf/renderer es ESM puro
  const { renderToBuffer } = await import("@react-pdf/renderer");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer: Buffer = await renderToBuffer(createElement(EstadoCuentaPDF, { data }) as any);

  const filename = `EstadoCuenta_${ec.parcela.numero}_${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
