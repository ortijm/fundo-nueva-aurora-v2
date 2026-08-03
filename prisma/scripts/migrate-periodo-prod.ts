import { PrismaClient } from "@prisma/client";

/**
 * Migración: cambiar periodo de cutoff (mayo) a billing (abril) en BD producción.
 * También recalcula todas las deudas de parcelas.
 *
 * Ejecutar con: npx tsx prisma/scripts/migrate-periodo-prod.ts
 * Requiere DATABASE_URL apuntando a la BD de producción (Supabase pooler con pgbouncer=true).
 */

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Migración de periodo: cutoff → billing (producción)\n");

  // ── 1. consumos_mensuales: primero eliminar duplicados, luego actualizar ──
  // Some parcels already have records for both periods — delete 2026-05 where 2026-04 exists
  const duplicatesRemoved = await prisma.$executeRaw`
    DELETE FROM consumos_mensuales
    WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
    AND (parcelaId, tipoConsumoId) IN (
      SELECT parcelaId, tipoConsumoId FROM consumos_mensuales
      WHERE periodo = '2026-04-01T00:00:00.000Z'::timestamp
    )
  `;
  console.log(`  🗑️  consumos_mensuales: ${duplicatesRemoved} duplicados eliminados (ya existían para 2026-04)`);

  const consumos = await prisma.$executeRaw`
    UPDATE consumos_mensuales
    SET periodo = '2026-04-01T00:00:00.000Z'::timestamp
    WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
  `;
  console.log(`  ✅ consumos_mensuales: ${consumos} registros actualizados (2026-05 → 2026-04)`);

  // ── 2. estados_cuenta: primero limpiar join table, luego duplicados, luego actualizar ──
  // Clean up _EstadoCuentaConsumos for ECs we're about to delete
  await prisma.$executeRaw`
    DELETE FROM "_EstadoCuentaConsumos"
    WHERE "A" IN (
      SELECT id FROM estados_cuenta
      WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
    )
  `;

  // Also clean up PagoConsumos join table for any linked consumos
  await prisma.$executeRaw`
    DELETE FROM "_PagoConsumos"
    WHERE "B" IN (
      SELECT id FROM consumos_mensuales
      WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
    )
  `;

  const duplicatesEcs = await prisma.$executeRaw`
    DELETE FROM estados_cuenta
    WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
    AND parcelaId IN (
      SELECT parcelaId FROM estados_cuenta
      WHERE periodo = '2026-04-01T00:00:00.000Z'::timestamp
    )
  `;
  console.log(`  🗑️  estados_cuenta: ${duplicatesEcs} duplicados eliminados (ya existían para 2026-04)`);

  const ecs = await prisma.$executeRaw`
    UPDATE estados_cuenta
    SET periodo = '2026-04-01T00:00:00.000Z'::timestamp
    WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
  `;
  console.log(`  ✅ estados_cuenta: ${ecs} registros actualizados (2026-05 → 2026-04)`);

  // ── 3. periodos_gasto: eliminar duplicado si existe, luego actualizar ──
  await prisma.$executeRaw`
    DELETE FROM periodos_gasto
    WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
    AND EXISTS (
      SELECT 1 FROM periodos_gasto pg2
      WHERE pg2.periodo = '2026-04-01T00:00:00.000Z'::timestamp
    )
  `;

  const periodos = await prisma.$executeRaw`
    UPDATE periodos_gasto
    SET periodo = '2026-04-01T00:00:00.000Z'::timestamp
    WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
  `;
  console.log(`  ✅ periodos_gasto: ${periodos} registros actualizados (2026-05 → 2026-04)`);

  // ── 4. Recalcular deudas de todas las parcelas ──
  console.log("\n📊 Recalculando deudas de parcelas...\n");

  const parcelas = await prisma.parcela.findMany({
    where: { estado: "ACTIVA" },
    select: { id: true, numero: true },
  });

  let deudasActualizadas = 0;

  for (const parcela of parcelas) {
    const consumos = await prisma.consumoMensual.findMany({
      where: { parcelaId: parcela.id },
      include: { tipoConsumo: true },
    });

    let deudaAgua = 0;
    let deudaLuz = 0;
    let deudaGc = 0;

    for (const c of consumos) {
      if (c.estado !== "PAGADO" && Number(c.totalAPagar) > 0) {
        if (c.tipoConsumo.nombre === "Agua") deudaAgua += Number(c.totalAPagar);
        else if (c.tipoConsumo.nombre === "Luz") deudaLuz += Number(c.totalAPagar);
        else if (c.tipoConsumo.nombre === "Gasto Común") deudaGc += Number(c.totalAPagar);
      }
    }

    const deudaTotal = deudaAgua + deudaLuz + deudaGc;

    await prisma.parcela.update({
      where: { id: parcela.id },
      data: { deudaAgua, deudaLuz, deudaGc, deudaTotal },
    });

    deudasActualizadas++;
    console.log(`  📦 ${parcela.numero}: Agua=$${deudaAgua.toLocaleString()} | Luz=$${deudaLuz.toLocaleString()} | GC=$${deudaGc.toLocaleString()} | Total=$${deudaTotal.toLocaleString()}`);
  }

  console.log(`\n✅ Deudas recalculadas: ${deudasActualizadas} parcelas`);

  // ── 5. Verificación ──
  console.log("\n🔍 Verificación post-migración:\n");

  const verifConsumos = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM consumos_mensuales WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
  `;
  const remaining = Number(verifConsumos[0]?.count ?? 0);
  console.log(`  Consumos con periodo 2026-05: ${remaining} (esperado: 0)`);

  const verifEcs = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM estados_cuenta WHERE periodo = '2026-05-01T00:00:00.000Z'::timestamp
  `;
  const remainingEcs = Number(verifEcs[0]?.count ?? 0);
  console.log(`  ECs con periodo 2026-05: ${remainingEcs} (esperado: 0)`);

  console.log("\n✅ Migración completada exitosamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
