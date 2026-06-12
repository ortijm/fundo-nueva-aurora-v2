"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadComprobante } from "@/lib/supabase/storage";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";
import crypto from "crypto";

const informarPagoSchema = z.object({
  monto: z.number().positive("El monto debe ser mayor a 0"),
  concepto: z.string().min(1, "El concepto es obligatorio"),
  fechaOperacion: z.string().transform((val) => new Date(val)),
});

export async function informarPago(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "PROPIETARIO") return unauthorized();

  const montoStr = formData.get("monto") as string;
  const monto = parseFloat(montoStr);
  const concepto = (formData.get("concepto") as string)?.trim() || "";
  const fechaOperacionStr = formData.get("fechaOperacion") as string;

  const rawData = {
    monto: isNaN(monto) ? -1 : monto,
    concepto,
    fechaOperacion: isNaN(new Date(fechaOperacionStr).getTime()) ? "" : fechaOperacionStr,
  };

  const parsed = informarPagoSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const comprobante = formData.get("comprobante") as File | null;
  if (!comprobante || comprobante.size === 0) return { success: false, error: "El comprobante es obligatorio" };

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(comprobante.type)) return { success: false, error: "Formato de comprobante no válido (JPG, PNG o PDF)" };
  if (comprobante.size > 5 * 1024 * 1024) return { success: false, error: "El comprobante supera el límite de 5 MB" };

  return withErrorHandling(async () => {
    const parcelaId = formData.get("parcelaId") as string;
    if (!parcelaId) throw new Error("Parcela no seleccionada");

    const parcela = await prisma.parcela.findFirst({
      where: { id: parcelaId, propietarioId: session.user.id, estado: "ACTIVA" },
    });
    if (!parcela) throw new Error("No tienes parcela asignada");

    // Use server-generated UUID to prevent path traversal and extension spoofing
    const allowedExts = ["jpg", "jpeg", "png", "gif", "webp", "pdf"];
    const rawExt = comprobante.name.split(".").pop()?.toLowerCase() || "";
    const ext = allowedExts.includes(rawExt) ? rawExt : "jpg";
    const filename = `pago_${parcela.numero}_${crypto.randomUUID()}.${ext}`;

    const uploaded = await uploadComprobante(filename, comprobante, comprobante.type);
    if (uploaded.error) throw new Error(uploaded.error);
    const comprobanteUrl = uploaded.url;

    const { monto, concepto, fechaOperacion } = parsed.data;
    const consumoIds = formData.getAll("consumos[]") as string[];

    const pago = await prisma.pago.create({
      data: {
        parcelaId: parcela.id,
        monto,
        fechaOperacion,
        concepto,
        comprobante: comprobanteUrl,
        registradoPorId: session.user.id,
      },
    });

    if (consumoIds.length > 0) {
      await prisma.pago.update({
        where: { id: pago.id },
        data: { consumos: { connect: consumoIds.map((id) => ({ id })) } },
      });

      await prisma.consumoMensual.updateMany({
        where: { id: { in: consumoIds }, parcelaId: parcela.id },
        data: { estado: "PAGO_INFORMADO" },
      });
    }

    const { enviarNotificacionPagoAdmin } = await import("@/lib/services/email");
    const emailResult = await enviarNotificacionPagoAdmin(pago.id);
    if (!emailResult.enviado) {
      console.error("Notificación admin no enviada:", emailResult.error);
    }

    revalidatePath("/propietario/dashboard");
    revalidatePath("/propietario/informar-pago");
    return { emailAdminEnviado: emailResult.enviado, emailAdminError: emailResult.error };
  }, "informarPago");
}