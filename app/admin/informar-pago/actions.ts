"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadComprobante } from "@/lib/supabase/storage";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";
import { actualizarDeudasParcela } from "@/lib/services/consumos";
import crypto from "crypto";

const informarPagoAdminSchema = z.object({
  parcelaId: z.string().min(1, "Debes seleccionar una parcela"),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  concepto: z.string().min(1, "El concepto es obligatorio"),
  fechaOperacion: z.string().transform((val) => new Date(val)),
});

export async function informarPagoAdmin(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parcelaId = formData.get("parcelaId") as string;
  const montoStr = formData.get("monto") as string;
  const monto = parseFloat(montoStr);
  const concepto = (formData.get("concepto") as string)?.trim() || "";
  const fechaOperacionStr = formData.get("fechaOperacion") as string;

  const rawData = {
    parcelaId,
    monto: isNaN(monto) ? -1 : monto,
    concepto,
    fechaOperacion: isNaN(new Date(fechaOperacionStr).getTime()) ? "" : fechaOperacionStr,
  };

  const parsed = informarPagoAdminSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const comprobante = formData.get("comprobante") as File | null;
  if (!comprobante || comprobante.size === 0) return { success: false, error: "El comprobante es obligatorio" };

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(comprobante.type)) return { success: false, error: "Formato de comprobante no válido (JPG, PNG o PDF)" };
  if (comprobante.size > 5 * 1024 * 1024) return { success: false, error: "El comprobante supera el límite de 5 MB" };

  return withErrorHandling(async () => {
    const parcela = await prisma.parcela.findUnique({
      where: { id: parcelaId, estado: "ACTIVA" },
    });
    if (!parcela) throw new Error("Parcela no encontrada o inactiva");

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
    const ahora = new Date();

    const pago = await prisma.pago.create({
      data: {
        parcelaId: parcela.id,
        monto,
        fechaOperacion,
        concepto,
        comprobante: comprobanteUrl,
        estado: "APROBADO",
        registradoPorId: session.user.id,
        aprobadoPorId: session.user.id,
        fechaAprobacion: ahora,
      },
    });

    if (consumoIds.length > 0) {
      await prisma.pago.update({
        where: { id: pago.id },
        data: { consumos: { connect: consumoIds.map((id) => ({ id })) } },
      });

      await prisma.consumoMensual.updateMany({
        where: { id: { in: consumoIds }, parcelaId: parcela.id },
        data: {
          estado: "PAGADO",
          pagado: true,
          fechaPago: ahora,
        },
      });

      await actualizarDeudasParcela(parcela.id);

      const ecs = await prisma.estadoCuenta.findMany({
        where: { consumos: { some: { id: { in: consumoIds } } } },
        include: { consumos: { select: { id: true, pagado: true, totalAPagar: true } } },
      });

      for (const ec of ecs) {
        if (ec.estado === "PAGADO") continue;
        const todosPagados = ec.consumos.every(
          (c) => c.pagado || Number(c.totalAPagar) === 0
        );
        if (todosPagados) {
          await prisma.estadoCuenta.update({
            where: { id: ec.id },
            data: { estado: "PAGADO" },
          });
        }
      }
    }

    await prisma.fondoCondominio.create({
      data: {
        tipo: "INGRESO",
        concepto: `Pago directo: ${concepto}`,
        monto,
        fecha: fechaOperacion,
        referencia: `Pago #${pago.id.slice(-6)}`,
        origenTipo: "PAGO",
        origenId: pago.id,
        registradoPorId: session.user.id,
      },
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/validacion");
    revalidatePath("/admin/fondos");
    revalidatePath("/admin/estados-cuenta");
    revalidatePath(`/propietario/parcela/${parcela.numero}`);

    return { pagoId: pago.id };
  }, "informarPagoAdmin");
}