"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

export async function informarPago(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "PROPIETARIO") return { error: "No autorizado" };

  const parcela = await prisma.parcela.findFirst({
    where: { propietarioId: session.user.id, estado: "ACTIVA" },
  });
  if (!parcela) return { error: "No tienes parcela asignada" };

  const montoStr = formData.get("monto") as string;
  const monto = parseFloat(montoStr);
  if (isNaN(monto) || monto <= 0) return { error: "Monto inválido" };

  const concepto = (formData.get("concepto") as string)?.trim();
  if (!concepto) return { error: "El concepto es obligatorio" };

  const fechaOperacion = new Date(formData.get("fechaOperacion") as string);
  if (isNaN(fechaOperacion.getTime())) return { error: "Fecha de operación inválida" };

  const comprobante = formData.get("comprobante") as File | null;
  if (!comprobante || comprobante.size === 0) return { error: "El comprobante es obligatorio" };

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(comprobante.type)) return { error: "Formato de comprobante no válido (JPG, PNG o PDF)" };
  if (comprobante.size > 5 * 1024 * 1024) return { error: "El comprobante supera el límite de 5 MB" };

  const ext = comprobante.name.split(".").pop() || "jpg";
  const filename = `pago_${parcela.numero}_${Date.now()}.${ext}`;

  let comprobanteUrl: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, comprobante, {
      access: "public",
    });
    comprobanteUrl = blob.url;
  } else {
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");
    const uploadDir = path.join(process.cwd(), "public", "uploads", "comprobantes");
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await comprobante.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);
    comprobanteUrl = `/uploads/comprobantes/${filename}`;
  }

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
  return { success: true, emailAdminEnviado: emailResult.enviado, emailAdminError: emailResult.error };
}