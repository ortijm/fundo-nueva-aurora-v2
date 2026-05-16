import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createElement } from "react";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { periodoStr } = await req.json();

  if (!periodoStr || !/^\d{4}-\d{2}$/.test(periodoStr)) {
    return NextResponse.json({ error: "Periodo invalido (formato: YYYY-MM)" }, { status: 400 });
  }

  const periodo = new Date(`${periodoStr}-01`);
  if (isNaN(periodo.getTime())) {
    return NextResponse.json({ error: "Periodo invalido" }, { status: 400 });
  }

  // 1. Obtener consumos PENDIENTE
  const consumos = await prisma.consumoMensual.findMany({
    where: { periodo, estado: "PENDIENTE" },
    include: {
      tipoConsumo: true,
      parcela: { include: { propietario: true } },
    },
    orderBy: { parcela: { numero: "asc" } },
  });

  if (consumos.length === 0) {
    return NextResponse.json({ error: "No hay consumos PENDIENTE para este periodo" }, { status: 400 });
  }

  // 2. Agrupar por parcela
  const porParcela = new Map<string, typeof consumos>();
  for (const c of consumos) {
    const arr = porParcela.get(c.parcelaId) || [];
    arr.push(c);
    porParcela.set(c.parcelaId, arr);
  }

  // 3. Verificar ECs existentes
  const parcelasIds = Array.from(porParcela.keys());
  const ecsExistentes = await prisma.estadoCuenta.findMany({
    where: { parcelaId: { in: parcelasIds }, periodo },
    select: { parcelaId: true },
  });
  const parcelasConEC = new Set(ecsExistentes.map((e) => e.parcelaId));

  // Filtrar parcelas sin EC
  const parcelasSinEC = Array.from(porParcela.entries()).filter(([id]) => !parcelasConEC.has(id));

  if (parcelasSinEC.length === 0) {
    return NextResponse.json({ 
      error: "Todas las parcelas ya tienen EC en este periodo" 
    }, { status: 400 });
  }

  // Crear directorio para PDFs
  const pdfDir = path.join(process.cwd(), "public", "uploads", "estados-cuenta");
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  const resultados: {
    parcelaNumero: string;
    consumosVinculados: number;
    pdfGenerado: boolean;
    error?: string;
  }[] = [];

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const config = await prisma.configuracionSistema.findFirst();

  for (const [parcelaId, cs] of parcelasSinEC) {
    const parcela = cs[0].parcela;
    const consumoIds = cs.map((c) => c.id);

    // Calcular subtotales
    let subtotalAgua = 0;
    let subtotalLuz = 0;
    let subtotalGc = 0;

    for (const c of cs) {
      const nombre = c.tipoConsumo.nombre.toLowerCase();
      const monto = Number(c.totalAPagar);
      if (nombre.includes("agua")) subtotalAgua += monto;
      else if (nombre.includes("luz")) subtotalLuz += monto;
      else if (nombre.includes("gasto")) subtotalGc += monto;
    }

    // Crear EC
    const ec = await prisma.estadoCuenta.create({
      data: {
        parcelaId,
        periodo,
        subtotalAgua,
        subtotalLuz,
        subtotalGc,
        deudaAnterior: 0,
        total: subtotalAgua + subtotalLuz + subtotalGc,
        estado: "BORRADOR",
        consumos: { connect: consumoIds.map((id) => ({ id })) },
      },
    });

    // Actualizar estado consumos
    await prisma.consumoMensual.updateMany({
      where: { id: { in: consumoIds } },
      data: { estado: "CON_ESTADO_CUENTA" },
    });

    // Generar PDF
    let pdfGenerado = false;
    try {
      const pdfFilename = `EstadoCuenta_${parcela.numero}_${periodoStr}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFilename);
      const dt = new Date(ec.periodo);
      const periodoLabel = `${meses[dt.getMonth()]} ${dt.getFullYear()}`;

      const propietario = parcela.propietario;
      const propietarioNombre = propietario
        ? `${propietario.firstName} ${propietario.lastName}`.trim() || propietario.username
        : "Sin propietario";

      const { EstadoCuentaPDF } = await import("@/lib/pdf/estado-cuenta-pdf");

      const data = {
        id: ec.id,
        parcelaNumero: parcela.numero,
        parcelaNombre: parcela.nombre || null,
        parcelaSector: null,
        propietarioNombre,
        periodoLabel,
        fechaEmision: ec.fechaEmision,
        subtotalAgua,
        subtotalLuz,
        subtotalGc,
        deudaAnterior: 0,
        total: subtotalAgua + subtotalLuz + subtotalGc,
        consumos: cs.map((c) => ({
          tipoNombre: c.tipoConsumo.nombre,
          periodo: c.periodo,
          lecturaAnterior: Number(c.lecturaAnterior),
          lecturaActual: Number(c.lecturaActual),
          consumoCalculado: Number(c.consumoCalculado),
          totalAPagar: Number(c.totalAPagar),
          esVariable: c.tipoConsumo.esVariable,
        })),
        nombreCondominio: config?.nombreCondominio || "Condominio Nueva Aurora",
        direccion: config?.direccion || "",
        telefono: config?.telefono || "",
        banco: config?.banco || "",
        tipoCuenta: config?.tipoCuenta || "",
        numeroCuenta: config?.numeroCuenta || "",
        nombreTitular: config?.nombreTitular || "",
        rutTitular: config?.rutTitular || "",
        emailPagos: config?.emailPagos || "",
        mensajePieEc: config?.mensajePieEc || "",
      };

      const { renderToBuffer } = await import("@react-pdf/renderer");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buffer = await renderToBuffer(createElement(EstadoCuentaPDF, { data } as any));
      fs.writeFileSync(pdfPath, buffer);

      await prisma.estadoCuenta.update({
        where: { id: ec.id },
        data: { pdf: `/uploads/estados-cuenta/${pdfFilename}` },
      });

      pdfGenerado = true;
    } catch (err) {
      resultados.push({
        parcelaNumero: parcela.numero,
        consumosVinculados: cs.length,
        pdfGenerado: false,
        error: (err as Error).message,
      });
      continue;
    }

    resultados.push({
      parcelaNumero: parcela.numero,
      consumosVinculados: cs.length,
      pdfGenerado,
    });
  }

  return NextResponse.json({
    success: true,
    periodo: periodoStr,
    totalParcelas: parcelasSinEC.length,
    resultados,
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const periodoStr = searchParams.get("periodo");

  if (!periodoStr || !/^\d{4}-\d{2}$/.test(periodoStr)) {
    return NextResponse.json({ error: "Periodo invalido" }, { status: 400 });
  }

  const periodo = new Date(`${periodoStr}-01`);

  // Consumos PENDIENTE
  const consumos = await prisma.consumoMensual.findMany({
    where: { periodo, estado: "PENDIENTE" },
    include: {
      tipoConsumo: true,
      parcela: true,
    },
    orderBy: { parcela: { numero: "asc" } },
  });

  if (consumos.length === 0) {
    return NextResponse.json({ 
      consumosPendientes: 0,
      parcelas: [],
      preview: { ecsExistentes: [], aCrear: [] },
    });
  }

  // Agrupar por parcela
  const porParcela = new Map<string, typeof consumos>();
  for (const c of consumos) {
    const arr = porParcela.get(c.parcelaId) || [];
    arr.push(c);
    porParcela.set(c.parcelaId, arr);
  }

  // ECs existentes
  const parcelasIds = Array.from(porParcela.keys());
  const ecsExistentes = await prisma.estadoCuenta.findMany({
    where: { parcelaId: { in: parcelasIds }, periodo },
    select: { parcelaId: true },
  });
  const parcelasConEC = new Set(ecsExistentes.map((e) => e.parcelaId));

  const ecsExistentesList = [];
  const aCrear = [];

  for (const [parcelaId, cs] of porParcela) {
    const parcela = cs[0].parcela;
    if (parcelasConEC.has(parcelaId)) {
      ecsExistentesList.push({ numero: parcela.numero });
    } else {
      const monto = cs.reduce((sum, c) => sum + Number(c.totalAPagar), 0);
      const tipos = cs.map((c) => c.tipoConsumo.nombre);
      aCrear.push({
        parcelaId,
        numero: parcela.numero,
        consumos: cs.length,
        monto,
        tipos,
      });
    }
  }

  return NextResponse.json({
    consumosPendientes: consumos.length,
    parcelas: Array.from(porParcela.values()).map((cs) => ({
      numero: cs[0].parcela.numero,
      consumos: cs.length,
      monto: cs.reduce((sum, c) => sum + Number(c.totalAPagar), 0),
    })),
    preview: {
      ecsExistentes: ecsExistentesList,
      aCrear,
    },
  });
}
