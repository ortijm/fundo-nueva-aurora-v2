"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generarGastosComunes } from "../consumos/actions";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";
import { actualizarDeudasParcela } from "@/lib/services/consumos";

export { generarGastosComunes };

const crearGastoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  categoria: z.enum(["MANTENIMIENTO", "SERVICIOS", "SERVICIOS_PUBLICOS", "REPARACION", "OTRO"]),
  periodicidad: z.enum(["MENSUAL", "PUNTUAL"]).optional().default("PUNTUAL"),
  proveedor: z.string().optional().default(""),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  fechaGasto: z.string().transform((val) => new Date(val)),
  notas: z.string().optional().default(""),
});

export async function crearGasto(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    nombre: formData.get("nombre") as string,
    categoria: formData.get("categoria") as "MANTENIMIENTO" | "SERVICIOS" | "SERVICIOS_PUBLICOS" | "REPARACION" | "OTRO",
    periodicidad: (formData.get("periodicidad") as "MENSUAL" | "PUNTUAL") || "PUNTUAL",
    proveedor: (formData.get("proveedor") as string) || "",
    monto: parseFloat(formData.get("monto") as string),
    fechaGasto: formData.get("fechaGasto") as string,
    notas: (formData.get("notas") as string) || "",
  };

  const parsed = crearGastoSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    await prisma.gastoCondominio.create({
      data: {
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        periodicidad: parsed.data.periodicidad,
        proveedor: parsed.data.proveedor,
        monto: parsed.data.monto,
        fechaGasto: parsed.data.fechaGasto,
        notas: parsed.data.notas,
        registradoPorId: session.user.id,
      },
    });

    // Registrar egreso en el fondo
    await prisma.fondoCondominio.create({
      data: {
        tipo: "EGRESO",
        concepto: parsed.data.nombre,
        monto: parsed.data.monto,
        fecha: parsed.data.fechaGasto,
        origenTipo: "GASTO",
        registradoPorId: session.user.id,
      },
    });

    revalidatePath("/admin/gastos");
    return { success: true };
  }, "crearGasto");
}

// ─── ELIMINAR GASTOS COMUNES POR PERÍODO ──────────────────────────────────

export async function previewEliminarGastosComunes(periodoISO: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  return withErrorHandling(async () => {
    const periodoDate = new Date(periodoISO);

    const periodoGasto = await prisma.periodoGasto.findUnique({
      where: { periodo: periodoDate },
    });
    if (!periodoGasto) {
      return { success: false, error: "No se encontraron gastos comunes para este período." };
    }

    const ecs = await prisma.estadoCuenta.findMany({
      where: { periodo: periodoDate },
      select: { id: true, parcelaId: true, estado: true },
    });

    const pagados = ecs.filter((ec) => ec.estado === "PAGADO");
    const pendientes = ecs.filter((ec) => ec.estado !== "PAGADO");

    return {
      success: true,
      data: {
        tienePagados: pagados.length > 0,
        pagados: pagados.length,
        pendientes: pendientes.length,
        totalEcs: ecs.length,
        parcelasPagadas: pagados.map((ec) => ec.parcelaId),
      },
    };
  }, "previewEliminarGastosComunes");
}

export async function eliminarGastosComunes(periodoISO: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  return withErrorHandling(async () => {
    const periodoDate = new Date(periodoISO);

    // 1. Buscar el registro PeriodoGasto
    const periodoGasto = await prisma.periodoGasto.findUnique({
      where: { periodo: periodoDate },
    });
    if (!periodoGasto) {
      return { success: false, error: "No se encontraron gastos comunes para este período." };
    }

    // 2. Buscar todos los EC de este período
    const ecs = await prisma.estadoCuenta.findMany({
      where: { periodo: periodoDate },
      select: { id: true, parcelaId: true, estado: true },
    });

    // 3. Si algún EC está PAGADO → bloquear
    const pagados = ecs.filter((ec) => ec.estado === "PAGADO");
    if (pagados.length > 0) {
      const parcelas = pagados.map((ec) => ec.parcelaId).join(", ");
      return {
        success: false,
        error: `No se puede eliminar: ${pagados.length} EC(s) ya están PAGADOS para este período (parcelas: ${parcelas}).`,
      };
    }

    // 4. Obtener parcelas afectadas de ECs
    const parcelaIdSet = new Set<string>();
    for (const ec of ecs) parcelaIdSet.add(ec.parcelaId);

    // 4b. Obtener parcelas con GC consumos antes de eliminarlos
    const tipoGc = await prisma.tipoConsumo.findFirst({
      where: { nombre: { contains: "Gasto" } },
    });

    if (tipoGc) {
      const gcConsumos = await prisma.consumoMensual.findMany({
        where: { tipoConsumoId: tipoGc.id, periodo: periodoDate },
        select: { parcelaId: true },
      });
      for (const c of gcConsumos) parcelaIdSet.add(c.parcelaId);
    }

    const parcelaIds = Array.from(parcelaIdSet);

    // 5. Eliminar ECs PENDIENTES (disconect del join table _EstadoCuentaConsumos se hace en cascada)
    if (ecs.length > 0) {
      await prisma.estadoCuenta.deleteMany({
        where: { periodo: periodoDate },
      });
    }

    // 6. Eliminar consumos GC de este período
    if (tipoGc) {
      await prisma.consumoMensual.deleteMany({
        where: {
          tipoConsumoId: tipoGc.id,
          periodo: periodoDate,
        },
      });
    }

    // 7. Eliminar el registro PeriodoGasto
    await prisma.periodoGasto.delete({
      where: { id: periodoGasto.id },
    });

    // 8. Recalcular deudas de parcelas afectadas
    for (const parcelaId of parcelaIds) {
      try {
        await actualizarDeudasParcela(parcelaId);
      } catch {
        // Si falla el recálculo, no detener la operación
      }
    }

    revalidatePath("/admin/gastos");
    revalidatePath("/admin/consumos");
    revalidatePath("/admin/estados-cuenta");
    return { success: true, eliminados: { ec: ecs.length, parcelas: parcelaIds.length } };
  }, "eliminarGastosComunes");
}
