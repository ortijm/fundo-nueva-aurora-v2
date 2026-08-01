/**
 * Migración one-time: asigna franquicia de agua 30 m³ a todas las parcelas existentes.
 *
 * USAGE:  npx tsx scripts/migrar-franquicia-agua.ts
 *
 * Lógica:
 *   - Recorre TODAS las parcelas (activas e inactivas): el requisito exige que
 *     todas las parcelas existentes queden con franquicia 30 m³.
 *   - Solo actualiza parcelas que no sean M3_30 → idempotente (2ª ejecución: 0 cambios).
 */
import { prisma } from "../lib/prisma";

async function main() {
  const parcelas = await prisma.parcela.findMany({
    select: { id: true, numero: true, franquiciaAgua: true },
  });
  console.log(`📦 ${parcelas.length} parcelas encontradas`);

  let actualizadas = 0;
  for (const p of parcelas) {
    if (p.franquiciaAgua !== "M3_30") {
      await prisma.parcela.update({
        where: { id: p.id },
        data: { franquiciaAgua: "M3_30" },
      });
      actualizadas++;
      console.log(`  Parcela ${p.numero} → M3_30`);
    }
  }
  console.log(`✅ ${actualizadas}/${parcelas.length} parcelas ajustadas a M3_30`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
