"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { actualizarDeudasParcela } from "@/lib/services/consumos";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

const aprobarPagoSchema = z.object({
  pagoId: z.string().min(1, "ID de pago requerido"),
});

export async function aprobarPago(pagoId: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = aprobarPagoSchema.safeParse({ pagoId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    const pago = await prisma.pago.findUnique({
      where: { id: pagoId },
      include: { consumos: true, parcela: { include: { propietario: true } } },
    });

    if (!pago) return { success: false, error: "Pago no encontrado" };
    if (pago.estado !== "PENDIENTE") return { success: false, error: "El pago ya fue procesado" };

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({
        where: { id: pagoId },
        data: {
          estado: "APROBADO",
          aprobadoPorId: session.user.id,
          fechaAprobacion: new Date(),
        },
      });

      // Marcar consumos como pagados
      for (const consumo of pago.consumos) {
        await tx.consumoMensual.update({
          where: { id: consumo.id },
          data: { pagado: true, estado: "PAGADO", fechaPago: new Date() },
        });
      }

      // Registrar ingreso al fondo
      await tx.fondoCondominio.create({
        data: {
          tipo: "INGRESO",
          concepto: `Pago aprobado: ${pago.concepto || pago.parcela.numero}`,
          monto: pago.monto,
          fecha: pago.fechaOperacion,
          referencia: `Pago #${pago.id.slice(-6)}`,
          origenTipo: "PAGO",
          origenId: pago.id,
          registradoPorId: session.user.id,
        },
      });
    });

    await actualizarDeudasParcela(pago.parcelaId);

    // Actualizar estado del EC si todos sus consumos quedaron pagados
    const consumoIds = pago.consumos.map((c) => c.id);
    const ecs = await prisma.estadoCuenta.findMany({
      where: { consumos: { some: { id: { in: consumoIds } } } },
      include: { consumos: { select: { id: true, pagado: true, totalAPagar: true } } },
    });
    for (const ec of ecs) {
      if (ec.estado === "PAGADO") continue;
      const todosPagados = ec.consumos.every((c) => c.pagado || Number(c.totalAPagar) === 0);
      if (todosPagados) {
        await prisma.estadoCuenta.update({
          where: { id: ec.id },
          data: { estado: "PAGADO" },
        });
      }
    }

    // Notificación (best-effort)
    try {
      const { enviarNotificacionPagoAprobado } = await import("@/lib/services/email");
      await enviarNotificacionPagoAprobado(pagoId);
    } catch (e) {
      console.error("[aprobacion] Error enviando notificación:", e);
    }

    revalidatePath("/admin/validacion");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/estados-cuenta");
    return { success: true };
  }, "aprobarPago");
}

const rechazarPagoSchema = z.object({
  pagoId: z.string().min(1, "ID de pago requerido"),
  motivo: z.string().min(1, "Motivo requerido"),
});

export async function rechazarPago(pagoId: string, motivo: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = rechazarPagoSchema.safeParse({ pagoId, motivo });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    const pago = await prisma.pago.findUnique({
      where: { id: pagoId },
      include: { consumos: true },
    });

    if (!pago || pago.estado !== "PENDIENTE") return { success: false, error: "Pago no válido" };

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({
        where: { id: pagoId },
        data: { estado: "RECHAZADO", motivoRechazo: motivo },
      });

      // Revertir consumos a CON_ESTADO_CUENTA
      for (const consumo of pago.consumos) {
        await tx.consumoMensual.update({
          where: { id: consumo.id },
          data: { estado: "CON_ESTADO_CUENTA" },
        });
      }
    });

    try {
      const { enviarNotificacionPagoRechazado } = await import("@/lib/services/email");
      await enviarNotificacionPagoRechazado(pagoId, motivo);
    } catch (e) {
      console.error("[rechazo] Error enviando notificación:", e);
    }

    revalidatePath("/admin/validacion");
    return { success: true };
  }, "rechazarPago");
}
