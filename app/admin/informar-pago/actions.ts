"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

export async function informarPagoAdmin(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    return { error: "No autorizado" };
  }

  const parcelaId = formData.get("parcelaId") as string;
  if (!parcelaId) return { error: "Debes seleccionar una parcela" };

  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId, estado: "ACTIVA" },
  });
  if (!parcela) return { error: "Parcela no encontrada o inactiva" };

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

  return { success: true, pagoId: pago.id };
}

async function actualizarDeudasParcela(parcelaId: string) {
  const consumos = await prisma.consumoMensual.findMany({
    where: { parcelaId },
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
    where: { id: parcelaId },
    data: {
      deudaAgua,
      deudaLuz,
      deudaGc,
      deudaTotal,
    },
  });
}