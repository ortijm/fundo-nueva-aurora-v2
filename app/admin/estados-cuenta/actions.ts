"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { actualizarDeudasParcela, calcularMontoAgua } from "@/lib/services/consumos";
import { enviarNotificacionEstadoCuenta } from "@/lib/services/email";
import { getConfig } from "@/lib/services/config";

import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

const generarEstadoCuentaSchema = z.object({
  parcelaId: z.string().min(1, "ID de parcela requerido"),
  periodoStr: z.string().min(1, "Período requerido"),
});

export async function generarEstadoCuenta(parcelaId: string, periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = generarEstadoCuentaSchema.safeParse({ parcelaId, periodoStr });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const periodo = new Date(periodoStr + "-01");

  return withErrorHandling(async () => {
    // Cargar parcela UNA vez: franquicia + propietario (Decisión 2 — evita query duplicada en la notificación)
    const parcela = await prisma.parcela.findUnique({
      where: { id: parcelaId },
      select: { numero: true, franquiciaAgua: true, propietario: true },
    });
    if (!parcela) return { success: false, error: "Parcela no encontrada" };

    // Buscar consumos PENDIENTE del período
    const consumos = await prisma.consumoMensual.findMany({
      where: { parcelaId, periodo, estado: "PENDIENTE" },
      include: { tipoConsumo: true },
    });

    if (consumos.length === 0) return { success: false, error: "No hay consumos pendientes para este período" };

    // Obtener config actual para recalcular montos
    const config = await getConfig();

    const franquiciaM3 = parcela.franquiciaAgua === "M3_30" ? 30 : 15;

    // Calcular subtotales con montos actuales de config
    let subtotalAgua = 0, subtotalLuz = 0, subtotalGc = 0;
    for (const c of consumos) {
      let monto = Number(c.totalAPagar);
      const nombre = c.tipoConsumo.nombre.toLowerCase();
      
      if (nombre.includes("luz")) {
        // Recalcular luz con costo actual
        monto = Number(c.consumoCalculado) * Number(config.costoLuzKwh);
        subtotalLuz += monto;
      } else if (nombre.includes("agua")) {
        // Recalcular agua con tarifas actuales y la franquicia DE LA PARCELA (Requisito 4)
        monto = calcularMontoAgua(Number(c.consumoCalculado), franquiciaM3, config);
        subtotalAgua += monto;
      } else {
        subtotalGc += monto;
      }
    }

    // Deuda anterior: consumos pendientes de períodos anteriores
    const consumosAnteriores = await prisma.consumoMensual.findMany({
      where: {
        parcelaId,
        periodo: { lt: periodo },
        estado: { in: ["PENDIENTE", "CON_ESTADO_CUENTA"] },
        pagado: false,
      },
    });
    const deudaAnterior = consumosAnteriores.reduce((s, c) => s + Number(c.totalAPagar), 0);

    const total = subtotalAgua + subtotalLuz + subtotalGc + deudaAnterior;

    const ec = await prisma.estadoCuenta.upsert({
      where: { parcelaId_periodo: { parcelaId, periodo } },
      create: {
        parcelaId,
        periodo,
        subtotalAgua,
        subtotalLuz,
        subtotalGc,
        deudaAnterior,
        total,
        estado: "EMITIDO",
        fechaEmision: new Date(),
        consumos: { connect: consumos.map(c => ({ id: c.id })) },
      },
      update: {
        subtotalAgua,
        subtotalLuz,
        subtotalGc,
        deudaAnterior,
        total,
        estado: "EMITIDO",
        fechaEmision: new Date(),
        consumos: { connect: consumos.map(c => ({ id: c.id })) },
      },
    });

    // Consumos con monto cero: ya no requieren pago, se marcan directamente como PAGADO
    const idsCero = consumos.filter(c => Number(c.totalAPagar) === 0).map(c => c.id);
    const idsConMonto = consumos.filter(c => Number(c.totalAPagar) > 0).map(c => c.id);

    if (idsCero.length > 0) {
      await prisma.consumoMensual.updateMany({
        where: { id: { in: idsCero } },
        data: { estado: "PAGADO", pagado: true, fechaPago: new Date() },
      });
    }
    if (idsConMonto.length > 0) {
      await prisma.consumoMensual.updateMany({
        where: { id: { in: idsConMonto } },
        data: { estado: "CON_ESTADO_CUENTA" },
      });
    }

    await actualizarDeudasParcela(parcelaId);

    // Enviar email y registrar notificación (parcela ya cargada al inicio — sin query duplicada)
    const emailResult = await enviarNotificacionEstadoCuenta(ec.id);

    if (parcela.propietario) {
      const periodoLabel = periodo.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
      await prisma.notificacion.create({
        data: {
          destinatarioId: parcela.propietario.id,
          tipo: "ESTADO_CUENTA",
          asunto: `Estado de Cuenta ${periodoLabel} — Parcela ${parcela.numero}`,
          mensaje: `Estado de cuenta generado. Total: $${total.toLocaleString("es-CL")}`,
          parcelaId,
          estadoEnvio: emailResult.enviado ? "ENVIADO" : "ERROR",
          errorDetalle: emailResult.error || null,
        },
      });
    }

    revalidatePath("/admin/estados-cuenta");
    revalidatePath("/admin/notificaciones");
    return { success: true, ecId: ec.id, emailEnviado: emailResult.enviado, emailError: emailResult.error };
  }, "generarEstadoCuenta");
}

export async function generarECSinNotificacion(parcelaId: string, periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = generarEstadoCuentaSchema.safeParse({ parcelaId, periodoStr });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const periodo = new Date(periodoStr + "-01");
  if (isNaN(periodo.getTime())) return { success: false, error: "Periodo inválido" };

  return withErrorHandling(async () => {
    const parcela = await prisma.parcela.findUnique({
      where: { id: parcelaId },
      include: {
        propietario: true,
        consumos: {
          where: { periodo, estado: "PENDIENTE" },
          include: { tipoConsumo: true },
        },
      },
    });

    if (!parcela) return { success: false, error: "Parcela no encontrada" };
    if (parcela.consumos.length === 0) return { success: false, error: "No hay consumos pendientes para este periodo" };

    const consumos = parcela.consumos;
    const franquiciaM3 = parcela.franquiciaAgua === "M3_30" ? 30 : 15;

    // Obtener config actual para recalcular montos
    const config = await getConfig();

    let subtotalAgua = 0;
    let subtotalLuz = 0;
    let subtotalGc = 0;

    for (const c of consumos) {
      let monto = Number(c.totalAPagar);
      const nombre = c.tipoConsumo.nombre.toLowerCase();

      if (nombre.includes("luz")) {
        // Recalcular luz con costo actual
        monto = Number(c.consumoCalculado) * Number(config.costoLuzKwh);
        subtotalLuz += monto;
      } else if (nombre.includes("agua")) {
        // Recalcular agua con tarifas actuales y la franquicia DE LA PARCELA ya cargada (Requisito 4)
        monto = calcularMontoAgua(Number(c.consumoCalculado), franquiciaM3, config);
        subtotalAgua += monto;
      } else if (nombre.includes("gasto")) {
        subtotalGc += monto;
      }
    }

    const consumosAnteriores = await prisma.consumoMensual.findMany({
      where: { parcelaId, periodo: { lt: periodo }, estado: { in: ["PENDIENTE", "CON_ESTADO_CUENTA"] } },
    });
    const deudaAnterior = consumosAnteriores.reduce((s, c) => s + Number(c.totalAPagar), 0);
    const total = subtotalAgua + subtotalLuz + subtotalGc + deudaAnterior;

    const existeEC = await prisma.estadoCuenta.findUnique({
      where: { parcelaId_periodo: { parcelaId, periodo } },
    });

    if (existeEC) return { success: false, error: "Esta parcela ya tiene EC para este periodo", existente: true };

    const ec = await prisma.estadoCuenta.create({
      data: {
        parcelaId,
        periodo,
        subtotalAgua,
        subtotalLuz,
        subtotalGc,
        deudaAnterior,
        total,
        estado: "EMITIDO",
        fechaEmision: new Date(),
        consumos: { connect: consumos.map(c => ({ id: c.id })) },
      },
    });

    const idsCero = consumos.filter(c => Number(c.totalAPagar) === 0).map(c => c.id);
    const idsConMonto = consumos.filter(c => Number(c.totalAPagar) > 0).map(c => c.id);

    if (idsCero.length > 0) {
      await prisma.consumoMensual.updateMany({
        where: { id: { in: idsCero } },
        data: { estado: "PAGADO", pagado: true, fechaPago: new Date() },
      });
    }
    if (idsConMonto.length > 0) {
      await prisma.consumoMensual.updateMany({
        where: { id: { in: idsConMonto } },
        data: { estado: "CON_ESTADO_CUENTA" },
      });
    }

    await actualizarDeudasParcela(parcelaId);

    revalidatePath("/admin/estados-cuenta");
    return { success: true, ecId: ec.id, parcelaNumero: parcela.numero };
  }, "generarECSinNotificacion");
}

export async function generarEstadosCuentaMasivoSinNotificacion(periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = generarEstadoCuentaSchema.partial().safeParse({ periodoStr });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const periodo = new Date(periodoStr + "-01");

  return withErrorHandling(async () => {
    const parcelas = await prisma.parcela.findMany({
      where: {
        estado: "ACTIVA",
        consumos: { some: { periodo, estado: "PENDIENTE" } },
      },
    });

    let ok = 0;
    const errores: string[] = [];
    const omitidos: string[] = [];

    for (const parcela of parcelas) {
      const result = await generarECSinNotificacion(parcela.id, periodoStr);
      if (result.error === "Esta parcela ya tiene EC para este periodo") {
        omitidos.push(parcela.numero);
      } else if (result.error) {
        errores.push(`${parcela.numero}: ${result.error}`);
      } else {
        ok++;
      }
    }

    revalidatePath("/admin/estados-cuenta");
    return { success: true, ok, errores, omitidos };
  }, "generarEstadosCuentaMasivoSinNotificacion");
}

export async function sincronizarEstadosEC() {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  return withErrorHandling(async () => {
    const ecs = await prisma.estadoCuenta.findMany({
      where: { estado: { not: "PAGADO" } },
      include: { consumos: { select: { id: true, pagado: true, totalAPagar: true } } },
    });

    let actualizados = 0;
    for (const ec of ecs) {
      if (ec.consumos.length === 0) continue;

      // Consumos de monto cero se consideran pagados (no requieren pago)
      const idsCero = ec.consumos.filter(c => Number(c.totalAPagar) === 0 && !c.pagado).map(c => c.id);
      if (idsCero.length > 0) {
        await prisma.consumoMensual.updateMany({
          where: { id: { in: idsCero } },
          data: { estado: "PAGADO", pagado: true, fechaPago: new Date() },
        });
      }

      const todosPagados = ec.consumos.every((c) => c.pagado || Number(c.totalAPagar) === 0);
      if (todosPagados) {
        await prisma.estadoCuenta.update({
          where: { id: ec.id },
          data: { estado: "PAGADO" },
        });
        actualizados++;
      }
    }

    revalidatePath("/admin/estados-cuenta");
    return { success: true, actualizados };
  }, "sincronizarEstadosEC");
}

export async function generarEstadosCuentaMasivo(periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = generarEstadoCuentaSchema.partial().safeParse({ periodoStr });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const periodo = new Date(periodoStr + "-01");

  return withErrorHandling(async () => {
    // Parcelas con consumos PENDIENTE en el período
    const parcelas = await prisma.parcela.findMany({
      where: {
        estado: "ACTIVA",
        consumos: { some: { periodo, estado: "PENDIENTE" } },
      },
    });

    let ok = 0;
    const errores: string[] = [];

    for (const parcela of parcelas) {
      const result = await generarEstadoCuenta(parcela.id, periodoStr);
      if (result.error) errores.push(`${parcela.numero}: ${result.error}`);
      else ok++;
    }

    revalidatePath("/admin/estados-cuenta");
    return { success: true, ok, errores };
  }, "generarEstadosCuentaMasivo");
}

const eliminarEstadoCuentaSchema = z.object({
  ecId: z.string().min(1, "ID de estado de cuenta requerido"),
});

export async function eliminarEstadoCuenta(ecId: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = eliminarEstadoCuentaSchema.safeParse({ ecId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    const ec = await prisma.estadoCuenta.findUnique({
      where: { id: ecId },
      include: {
        consumos: {
          include: {
            pagos: true,
          },
        },
      },
    });

    if (!ec) return { success: false, error: "Estado de cuenta no encontrado" };

    if (ec.estado === "PAGADO") {
      return { success: false, error: "No se puede eliminar un estado de cuenta PAGADO" };
    }

    const consumosIds = ec.consumos.map((c) => c.id);
    const tienePagosAprobados = ec.consumos.some((c) =>
      c.pagos.some((p) => p.estado === "APROBADO")
    );

    if (tienePagosAprobados) {
      return { success: false, error: "No se puede eliminar: tiene pagos aprobados asociados" };
    }

    await prisma.$transaction(async (tx) => {
      if (consumosIds.length > 0) {
        await tx.consumoMensual.updateMany({
          where: { id: { in: consumosIds } },
          data: { estado: "PENDIENTE" },
        });

        await tx.consumoMensual.updateMany({
          where: { id: { in: consumosIds } },
          data: { pagado: false, fechaPago: null },
        });

        const pagosNoAprobados = await tx.pago.findMany({
          where: {
            consumos: { some: { id: { in: consumosIds } } },
            estado: { in: ["PENDIENTE", "RECHAZADO", "ANULADO"] },
          },
        });

        for (const pago of pagosNoAprobados) {
          await tx.pago.delete({ where: { id: pago.id } });
        }
      }

      await tx.estadoCuenta.delete({ where: { id: ecId } });

      await actualizarDeudasParcela(ec.parcelaId);
    });

    revalidatePath("/admin/estados-cuenta");
    revalidatePath("/admin/validacion");
    revalidatePath(`/admin/fondos`);

    return { success: true };
  }, "eliminarEstadoCuenta");
}
