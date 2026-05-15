"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { calcularConsumo, actualizarDeudasParcela } from "@/lib/services/consumos";
import { getConfig } from "@/lib/services/config";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

const guardarLecturaSchema = z.object({
  parcelaId: z.string().min(1, "Parcela requerida"),
  tipoConsumoId: z.string().min(1, "Tipo de consumo requerido"),
  periodo: z.string().min(1, "Período requerido"),
  lecturaActual: z.number(),
  observaciones: z.string().optional().default(""),
});

export async function guardarLectura(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    parcelaId: formData.get("parcelaId") as string,
    tipoConsumoId: formData.get("tipoConsumoId") as string,
    periodo: formData.get("periodo") as string,
    lecturaActual: parseFloat(formData.get("lecturaActual") as string),
    observaciones: (formData.get("observaciones") as string) || "",
  };

  const parsed = guardarLecturaSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { parcelaId, tipoConsumoId, periodo, lecturaActual, observaciones } = parsed.data;
  const periodoDate = new Date(periodo + "-01");

  return withErrorHandling(async () => {
    const calc = await calcularConsumo(parcelaId, tipoConsumoId, periodoDate, lecturaActual);

    await prisma.consumoMensual.upsert({
      where: {
        parcelaId_tipoConsumoId_periodo: { parcelaId, tipoConsumoId, periodo: periodoDate },
      },
      create: {
        parcelaId,
        tipoConsumoId,
        periodo: periodoDate,
        registradoPorId: session.user.id,
        observaciones,
        ...calc,
      },
      update: {
        lecturaActual: calc.lecturaActual,
        lecturaAnterior: calc.lecturaAnterior,
        consumoCalculado: calc.consumoCalculado,
        tarifaAplicada: calc.tarifaAplicada,
        montoConsumo: calc.montoConsumo,
        totalAPagar: calc.totalAPagar,
        observaciones,
        registradoPorId: session.user.id,
      },
    });

    await actualizarDeudasParcela(parcelaId);
    revalidatePath("/admin/consumos");
    return { success: true };
  }, "guardarLectura");
}

const generarGastosComunesSchema = z.object({
  periodo: z.string().min(1, "Período requerido"),
});

export async function generarGastosComunes(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    periodo: formData.get("periodo") as string,
  };

  const parsed = generarGastosComunesSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { periodo } = parsed.data;
  const periodoDate = new Date(periodo + "-01");

  return withErrorHandling(async () => {
    const config = await getConfig();

    const parcelas = await prisma.parcela.findMany({
      where: { estado: "ACTIVA" },
      include: { consumos: { take: 1 } },
    });

    const tipoGc = await prisma.tipoConsumo.findFirst({
      where: { nombre: { contains: "Gasto" } },
    });

    if (!tipoGc) return { success: false, error: "Tipo 'Gasto Común' no existe. Créalo en la base de datos." };

    let creados = 0;
    for (const parcela of parcelas) {
      const tieneHistorial = await prisma.consumoMensual.count({
        where: { parcelaId: parcela.id, tipoConsumoId: { not: tipoGc.id } },
      });

      const monto = tieneHistorial > 0
        ? Number(config.montoGcConHistorial)
        : Number(config.montoGcNuevo);

      try {
        await prisma.consumoMensual.upsert({
          where: {
            parcelaId_tipoConsumoId_periodo: {
              parcelaId: parcela.id,
              tipoConsumoId: tipoGc.id,
              periodo: periodoDate,
            },
          },
          create: {
            parcelaId: parcela.id,
            tipoConsumoId: tipoGc.id,
            periodo: periodoDate,
            montoConsumo: monto,
            totalAPagar: monto,
            registradoPorId: session.user.id,
          },
          update: {},
        });
        await actualizarDeudasParcela(parcela.id);
        creados++;
      } catch {}
    }

    await prisma.periodoGasto.upsert({
      where: { periodo: periodoDate },
      create: { periodo: periodoDate, generadoPorId: session.user.id },
      update: {},
    });

    revalidatePath("/admin/consumos");
    revalidatePath("/admin/gastos");
    return { success: true, creados };
  }, "generarGastosComunes");
}

const importarExcelRowSchema = z.object({
  parcelaNumero: z.string().min(1, "Número de parcela requerido"),
  tipoConsumoId: z.string().optional(),
  tipoNombre: z.string().optional(),
  periodo: z.string().min(1, "Período requerido"),
  lecturaActual: z.number(),
  lecturaAnterior: z.number().optional(),
  observaciones: z.string().optional(),
});

const importarExcelConsumosSchema = z.array(importarExcelRowSchema);

export async function importarExcelConsumos(data: {
  parcelaNumero: string;
  tipoConsumoId?: string;
  tipoNombre?: string;
  periodo: string;
  lecturaActual: number;
  lecturaAnterior?: number;
  observaciones?: string;
}[]) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = importarExcelConsumosSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    // Cache tipos para no repetir queries
    const tiposCache = new Map<string, string>();
    const getTipoId = async (id?: string, nombre?: string): Promise<string | null> => {
      if (id) return id;
      if (!nombre) return null;
      const key = nombre.toLowerCase().trim();
      if (tiposCache.has(key)) return tiposCache.get(key)!;
      const tipo = await prisma.tipoConsumo.findFirst({ where: { nombre: { contains: nombre } } });
      if (tipo) tiposCache.set(key, tipo.id);
      return tipo?.id ?? null;
    };

    let ok = 0;
    const errores: string[] = [];

    for (const row of parsed.data) {
      try {
        const parcela = await prisma.parcela.findUnique({ where: { numero: row.parcelaNumero } });
        if (!parcela) { errores.push(`Parcela "${row.parcelaNumero}" no encontrada`); continue; }

        const tipoConsumoId = await getTipoId(row.tipoConsumoId, row.tipoNombre);
        if (!tipoConsumoId) { errores.push(`Tipo desconocido en parcela ${row.parcelaNumero}`); continue; }

        const periodo = new Date(row.periodo + "-01");

        // Si el Excel trae lecturaAnterior, siempre usarla (permite corregir datos al reimportar).
        // Si no viene, calcularConsumo la toma del último registro en BD.
        const lecturaAnteriorOverride: number | undefined = row.lecturaAnterior;

        const calc = await calcularConsumo(parcela.id, tipoConsumoId, periodo, row.lecturaActual, lecturaAnteriorOverride);

        await prisma.consumoMensual.upsert({
          where: { parcelaId_tipoConsumoId_periodo: { parcelaId: parcela.id, tipoConsumoId, periodo } },
          create: { parcelaId: parcela.id, tipoConsumoId, periodo, registradoPorId: session.user.id, observaciones: row.observaciones || "", ...calc },
          update: { lecturaAnterior: calc.lecturaAnterior, lecturaActual: calc.lecturaActual, consumoCalculado: calc.consumoCalculado, tarifaAplicada: calc.tarifaAplicada, montoConsumo: calc.montoConsumo, totalAPagar: calc.totalAPagar },
        });

        await actualizarDeudasParcela(parcela.id);
        ok++;
      } catch {
        errores.push(`Error en parcela ${row.parcelaNumero}`);
      }
    }

    revalidatePath("/admin/consumos");
    return { ok, errores };
  }, "importarExcelConsumos");
}
