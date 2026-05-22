/**
 * Migración one-time: asigna tipoGc a parcelas existentes según historial.
 *
 * USAGE:  npx tsx scripts/migrar-tipo-gc.ts
 *
 * Lógica:
 *   - Parcela con historial de consumo (agua/luz) → NORMAL ($25.000)
 *   - Parcela sin historial de consumo → REDUCIDO ($15.000)
 */
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 Buscando tipo 'Gasto Común' para excluir del historial...");

  const tipoGc = await prisma.tipoConsumo.findFirst({
    where: { nombre: { contains: "Gasto" } },
  });

  const parcelas = await prisma.parcela.findMany({
    where: { estado: "ACTIVA" },
  });

  console.log(`📦 ${parcelas.length} parcelas activas encontradas`);

  let normal = 0;
  let reducido = 0;

  for (const parcela of parcelas) {
    const tieneHistorial = await prisma.consumoMensual.count({
      where: {
        parcelaId: parcela.id,
        tipoConsumoId: tipoGc ? { not: tipoGc.id } : undefined,
      },
    });

    const tipo = tieneHistorial > 0 ? "NORMAL" : "REDUCIDO";

    await prisma.parcela.update({
      where: { id: parcela.id },
      data: { tipoGc: tipo },
    });

    if (tieneHistorial > 0) normal++;
    else reducido++;

    console.log(`  Parcela ${parcela.numero} → ${tipo}`);
  }

  console.log(`\n✅ Migración completa:`);
  console.log(`   NORMAL:   ${normal} parcelas`);
  console.log(`   REDUCIDO: ${reducido} parcelas`);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
