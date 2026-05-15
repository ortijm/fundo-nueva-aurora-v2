"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { actualizarDeudasParcela, calcularMontoAguaTramos } from "@/lib/services/consumos";
import { enviarNotificacionEstadoCuenta } from "@/lib/services/email";
import { getConfig } from "@/lib/services/config";
import { toDecimal } from "@/lib/utils";

export async function generarEstadoCuenta(parcelaId: string, periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const periodo = new Date(periodoStr + "-01");

  // Buscar consumos PENDIENTE del período
  const consumos = await prisma.consumoMensual.findMany({
    where: { parcelaId, periodo, estado: "PENDIENTE" },
    include: { tipoConsumo: true },
  });

  if (consumos.length === 0) return { error: "No hay consumos pendientes para este período" };

  // Obtener config actual para recalcular montos
  const config = await getConfig();

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
      // Recalcular agua con tarifas actuales
      const franquia = Number(config.franquiciaAguaM3);
      const sobreconsumo = Math.max(0, Number(c.consumoCalculado) - franquia);
      monto = calcularMontoAguaTramos(sobreconsumo, {
        t1_10: Number(config.tarifaAgua1_10),
        t11_20: Number(config.tarifaAgua11_20),
        t21_30: Number(config.tarifaAgua21_30),
        t31_40: Number(config.tarifaAgua31_40),
        t41mas: Number(config.tarifaAgua41mas),
      });
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

  try {
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

    // Enviar email y registrar notificación
    const emailResult = await enviarNotificacionEstadoCuenta(ec.id);

    // Buscar propietario para crear registro de notificación
    const parcela = await prisma.parcela.findUnique({
      where: { id: parcelaId },
      include: { propietario: true },
    });

    if (parcela?.propietario) {
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
  } catch (e) {
    console.error(e);
    return { error: "Error al generar estado de cuenta" };
  }
}

export async function generarECSinNotificacion(parcelaId: string, periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const periodo = new Date(periodoStr + "-01");
  if (isNaN(periodo.getTime())) return { error: "Periodo inválido" };

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

  if (!parcela) return { error: "Parcela no encontrada" };
  if (parcela.consumos.length === 0) return { error: "No hay consumos pendientes para este periodo" };

  const consumos = parcela.consumos;
  
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
      // Recalcular agua con tarifas actuales
      const franquia = Number(config.franquiciaAguaM3);
      const sobreconsumo = Math.max(0, Number(c.consumoCalculado) - franquia);
      monto = calcularMontoAguaTramos(sobreconsumo, {
        t1_10: Number(config.tarifaAgua1_10),
        t11_20: Number(config.tarifaAgua11_20),
        t21_30: Number(config.tarifaAgua21_30),
        t31_40: Number(config.tarifaAgua31_40),
        t41mas: Number(config.tarifaAgua41mas),
      });
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

  if (existeEC) return { error: "Esta parcela ya tiene EC para este periodo", existente: true };

  try {
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
  } catch (e) {
    console.error(e);
    return { error: "Error al generar estado de cuenta" };
  }
}

export async function generarEstadosCuentaMasivoSinNotificacion(periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const periodo = new Date(periodoStr + "-01");

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
}

export async function sincronizarEstadosEC() {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

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
}

export async function generarEstadosCuentaMasivo(periodoStr: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const periodo = new Date(periodoStr + "-01");

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
}

export async function eliminarEstadoCuenta(ecId: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    return { error: "No autorizado" };
  }

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

  if (!ec) return { error: "Estado de cuenta no encontrado" };

  if (ec.estado === "PAGADO") {
    return { error: "No se puede eliminar un estado de cuenta PAGADO" };
  }

  const consumosIds = ec.consumos.map((c) => c.id);
  const tienePagosAprobados = ec.consumos.some((c) =>
    c.pagos.some((p) => p.estado === "APROBADO")
  );

  if (tienePagosAprobados) {
    return { error: "No se puede eliminar: tiene pagos aprobados asociados" };
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
}
