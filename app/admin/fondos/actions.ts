"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function registrarGasto(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const nombre = (formData.get("nombre") as string)?.trim();
  const categoria = formData.get("categoria") as "MANTENIMIENTO" | "SERVICIOS" | "SERVICIOS_PUBLICOS" | "REPARACION" | "OTRO";
  const monto = parseFloat(formData.get("monto") as string);
  const proveedor = (formData.get("proveedor") as string)?.trim() || "";
  const fechaGasto = new Date(formData.get("fechaGasto") as string);
  const notas = (formData.get("notas") as string)?.trim() || "";

  if (!nombre || isNaN(monto) || monto <= 0) return { error: "Datos incompletos" };

  await prisma.gastoCondominio.create({
    data: {
      nombre,
      categoria,
      monto,
      proveedor,
      fechaGasto,
      notas,
      registradoPorId: session.user.id,
    },
  });

  await prisma.fondoCondominio.create({
    data: {
      tipo: "EGRESO",
      concepto: nombre,
      monto,
      fecha: fechaGasto,
      referencia: proveedor,
      observaciones: notas,
      origenTipo: "MANUAL",
      categoria,
      registradoPorId: session.user.id,
    },
  });

  revalidatePath("/admin/fondos");
  revalidatePath("/admin/gastos");
  return { success: true };
}

export async function editarTransaccionManual(id: string, formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const transaccion = await prisma.fondoCondominio.findUnique({
    where: { id },
  });

  if (!transaccion) return { error: "Transacción no encontrada" };
  if (transaccion.origenTipo !== "MANUAL") return { error: "Solo se pueden editar gastos manuales" };

  const nombre = (formData.get("nombre") as string)?.trim();
  const categoria = formData.get("categoria") as "MANTENIMIENTO" | "SERVICIOS" | "SERVICIOS_PUBLICOS" | "REPARACION" | "OTRO";
  const monto = parseFloat(formData.get("monto") as string);
  const proveedor = (formData.get("proveedor") as string)?.trim() || "";
  const fechaGasto = new Date(formData.get("fechaGasto") as string);
  const notas = (formData.get("notas") as string)?.trim() || "";

  if (!nombre || isNaN(monto) || monto <= 0) return { error: "Datos incompletos" };

  await prisma.fondoCondominio.update({
    where: { id },
    data: {
      concepto: nombre,
      monto,
      fecha: fechaGasto,
      referencia: proveedor,
      observaciones: notas,
      categoria,
    },
  });

  const gasto = await prisma.gastoCondominio.findFirst({
    where: { id },
  });

  if (gasto) {
    await prisma.gastoCondominio.update({
      where: { id },
      data: {
        nombre,
        categoria,
        monto,
        proveedor,
        fechaGasto,
        notas,
      },
    });
  }

  revalidatePath("/admin/fondos");
  return { success: true };
}

export async function eliminarTransaccionManual(id: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const transaccion = await prisma.fondoCondominio.findUnique({
    where: { id },
  });

  if (!transaccion) return { error: "Transacción no encontrada" };
  if (transaccion.origenTipo !== "MANUAL") return { error: "Solo se pueden eliminar transacciones manuales" };

  await prisma.gastoCondominio.deleteMany({
    where: { id },
  });

  await prisma.fondoCondominio.delete({
    where: { id },
  });

  revalidatePath("/admin/fondos");
  return { success: true };
}
