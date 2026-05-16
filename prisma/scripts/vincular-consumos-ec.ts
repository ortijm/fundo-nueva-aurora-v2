import { PrismaClient } from "@prisma/client";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { createElement } from "react";

const prisma = new PrismaClient();

function pregunta(pregunta: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close();
      resolve(respuesta);
    });
  });
}

async function main() {
  console.log("\n=== VINCULAR CONSUMOS A ESTADOS DE CUENTA ===\n");

  const periodoStr = await pregunta("Ingrese periodo (YYYY-MM): ");
  const periodo = new Date(`${periodoStr}-01`);
  if (isNaN(periodo.getTime())) {
    console.log("❌ Periodo invalido");
    process.exit(1);
  }

  // 1. Obtener todos los consumos PENDIENTE del periodo
  const consumos = await prisma.consumoMensual.findMany({
    where: {
      periodo,
      estado: "PENDIENTE",
    },
    include: {
      tipoConsumo: true,
      parcela: {
        include: { propietario: true },
      },
    },
    orderBy: { parcela: { numero: "asc" } },
  });

  if (consumos.length === 0) {
    console.log("❌ No hay consumos PENDIENTE para este periodo");
    process.exit(0);
  }

  // 2. Agrupar consumos por parcela
  const porParcela = new Map<string, typeof consumos>();
  for (const c of consumos) {
    const arr = porParcela.get(c.parcelaId) || [];
    arr.push(c);
    porParcela.set(c.parcelaId, arr);
  }

  // 3. Verificar ECs existentes en el periodo
  const parcelasIds = Array.from(porParcela.keys());
  const ecsExistentes = await prisma.estadoCuenta.findMany({
    where: {
      parcelaId: { in: parcelasIds },
      periodo,
    },
    select: { parcelaId: true },
  });

  const parcelasConEC = new Set(ecsExistentes.map((e) => e.parcelaId));

  // 4. Mostrar preview
  console.log(`\nPeriodo: ${periodoStr}`);
  console.log(`Consumos pendientes: ${consumos.length} en ${porParcela.size} parcela(s)\n`);

  console.log("EC existentes en este periodo:");
  if (parcelasConEC.size === 0) {
    console.log("  (ninguno)\n");
  } else {
    for (const [parcelaId] of porParcela) {
      if (parcelasConEC.has(parcelaId)) {
        const parcela = porParcela.get(parcelaId)![0].parcela;
        console.log(`  • ${parcela.numero}: EC ya creado → omitido`);
      }
    }
    console.log("");
  }

  console.log("Parcelas SIN EC (a crear):");
  let totalACrear = 0;
  let consumosACrear = 0;
  for (const [parcelaId, cs] of porParcela) {
    if (!parcelasConEC.has(parcelaId)) {
      const parcela = cs[0].parcela;
      const monto = cs.reduce((sum, c) => sum + Number(c.totalAPagar), 0);
      const tipos = cs.map((c) => c.tipoConsumo.nombre).join(", ");
      console.log(`  • ${parcela.numero}: ${cs.length} consumo(s) - $${monto.toLocaleString("es-CL")} (${tipos})`);
      totalACrear++;
      consumosACrear += cs.length;
    }
  }

  if (totalACrear === 0) {
    console.log("  (ninguna - todas las parcelas ya tienen EC)\n");
    console.log("✅ No hay nada que procesar");
    process.exit(0);
  }

  console.log("\n------------------------------------------------------------");
  console.log(`  Total: ${totalACrear} EC(s) a crear, ${consumosACrear} consumos a vincular`);
  console.log("");

  const confirmar = await pregunta("¿Procesar? (s/n): ");
  if (confirmar.toLowerCase() !== "s") {
    console.log("Operacion cancelada");
    process.exit(0);
  }

  console.log("\nProcesando...\n");

  // 5. Crear directorio para PDFs si no existe
  const pdfDir = path.join(process.cwd(), "public", "uploads", "estados-cuenta");
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  let ecCreados = 0;
  let consumosVinculados = 0;
  let pdfsGenerados = 0;

  // 6. Procesar cada parcela SIN EC
  for (const [parcelaId, cs] of porParcela) {
    if (parcelasConEC.has(parcelaId)) continue;

    const parcela = cs[0].parcela;
    const consumoIds = cs.map((c) => c.id);

    // Calcular subtotales por tipo
    let subtotalAgua = 0;
    let subtotalLuz = 0;
    let subtotalGc = 0;

    for (const c of cs) {
      const nombre = c.tipoConsumo.nombre.toLowerCase();
      const monto = Number(c.totalAPagar);
      if (nombre.includes("agua")) {
        subtotalAgua += monto;
      } else if (nombre.includes("luz")) {
        subtotalLuz += monto;
      } else if (nombre.includes("gasto")) {
        subtotalGc += monto;
      }
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

    // Actualizar estado de consumos
    await prisma.consumoMensual.updateMany({
      where: { id: { in: consumoIds } },
      data: { estado: "CON_ESTADO_CUENTA" },
    });

    // Generar PDF
    try {
      const pdfFilename = `EstadoCuenta_${parcela.numero}_${periodoStr}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFilename);

      // Preparar datos para el PDF
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
      ];
      const dt = new Date(ec.periodo);
      const periodoLabel = `${meses[dt.getMonth()]} ${dt.getFullYear()}`;

      const propietario = parcela.propietario;
      const propietarioNombre = propietario
        ? `${propietario.firstName} ${propietario.lastName}`.trim() || propietario.username
        : "Sin propietario";

      // Obtener config del sistema
      const config = await prisma.configuracionSistema.findFirst();

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

      // Generar PDF
      const { renderToBuffer } = await import("@react-pdf/renderer");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buffer = await renderToBuffer(createElement(EstadoCuentaPDF, { data }) as any);

      // Guardar PDF
      fs.writeFileSync(pdfPath, buffer);

      // Actualizar EC con ruta del PDF
      await prisma.estadoCuenta.update({
        where: { id: ec.id },
        data: { pdf: `/uploads/estados-cuenta/${pdfFilename}` },
      });

      pdfsGenerados++;
      console.log(`  ✓ ${parcela.numero}: EC creado con PDF`);
    } catch (err) {
      console.log(`  ✓ ${parcela.numero}: EC creado (PDF no generado: ${(err as Error).message})`);
    }

    ecCreados++;
    consumosVinculados += cs.length;
  }

  console.log("\n=== RESUMEN ===");
  console.log(`Estados de cuenta creados: ${ecCreados}`);
  console.log(`Consumos vinculados: ${consumosVinculados}`);
  console.log(`PDFs generados: ${pdfsGenerados}`);
  console.log("\n✅ Proceso completado!\n");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
