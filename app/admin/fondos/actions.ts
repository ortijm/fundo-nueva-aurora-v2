"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

const registrarGastoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  categoria: z.enum(["MANTENIMIENTO", "SERVICIOS", "SERVICIOS_PUBLICOS", "REPARACION", "OTRO"]),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  proveedor: z.string().optional().default(""),
  fechaGasto: z.string().transform((val) => new Date(val)),
  notas: z.string().optional().default(""),
});

export async function registrarGasto(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    nombre: (formData.get("nombre") as string)?.trim() || "",
    categoria: formData.get("categoria") as "MANTENIMIENTO" | "SERVICIOS" | "SERVICIOS_PUBLICOS" | "REPARACION" | "OTRO",
    monto: parseFloat(formData.get("monto") as string),
    proveedor: (formData.get("proveedor") as string)?.trim() || "",
    fechaGasto: formData.get("fechaGasto") as string,
    notas: (formData.get("notas") as string)?.trim() || "",
  };

  const parsed = registrarGastoSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    await prisma.gastoCondominio.create({
      data: {
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        monto: parsed.data.monto,
        proveedor: parsed.data.proveedor,
        fechaGasto: parsed.data.fechaGasto,
        notas: parsed.data.notas,
        registradoPorId: session.user.id,
      },
    });

    await prisma.fondoCondominio.create({
      data: {
        tipo: "EGRESO",
        concepto: parsed.data.nombre,
        monto: parsed.data.monto,
        fecha: parsed.data.fechaGasto,
        referencia: parsed.data.proveedor,
        observaciones: parsed.data.notas,
        origenTipo: "MANUAL",
        categoria: parsed.data.categoria,
        registradoPorId: session.user.id,
      },
    });

    revalidatePath("/admin/fondos");
    revalidatePath("/admin/gastos");
    return { success: true };
  }, "registrarGasto");
}

const editarTransaccionSchema = z.object({
  id: z.string().min(1, "ID requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  categoria: z.enum(["MANTENIMIENTO", "SERVICIOS", "SERVICIOS_PUBLICOS", "REPARACION", "OTRO"]),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  proveedor: z.string().optional().default(""),
  fechaGasto: z.string().transform((val) => new Date(val)),
  notas: z.string().optional().default(""),
});

export async function editarTransaccionManual(id: string, formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    id,
    nombre: (formData.get("nombre") as string)?.trim() || "",
    categoria: formData.get("categoria") as "MANTENIMIENTO" | "SERVICIOS" | "SERVICIOS_PUBLICOS" | "REPARACION" | "OTRO",
    monto: parseFloat(formData.get("monto") as string),
    proveedor: (formData.get("proveedor") as string)?.trim() || "",
    fechaGasto: formData.get("fechaGasto") as string,
    notas: (formData.get("notas") as string)?.trim() || "",
  };

  const parsed = editarTransaccionSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    const transaccion = await prisma.fondoCondominio.findUnique({
      where: { id },
    });

    if (!transaccion) return { success: false, error: "Transacción no encontrada" };
    if (transaccion.origenTipo !== "MANUAL") return { success: false, error: "Solo se pueden editar gastos manuales" };

    await prisma.fondoCondominio.update({
      where: { id },
      data: {
        concepto: parsed.data.nombre,
        monto: parsed.data.monto,
        fecha: parsed.data.fechaGasto,
        referencia: parsed.data.proveedor,
        observaciones: parsed.data.notas,
        categoria: parsed.data.categoria,
      },
    });

    const gasto = await prisma.gastoCondominio.findFirst({
      where: { id },
    });

    if (gasto) {
      await prisma.gastoCondominio.update({
        where: { id },
        data: {
          nombre: parsed.data.nombre,
          categoria: parsed.data.categoria,
          monto: parsed.data.monto,
          proveedor: parsed.data.proveedor,
          fechaGasto: parsed.data.fechaGasto,
          notas: parsed.data.notas,
        },
      });
    }

    revalidatePath("/admin/fondos");
    return { success: true };
  }, "editarTransaccionManual");
}

const eliminarTransaccionSchema = z.object({
  id: z.string().min(1, "ID requerido"),
});

export async function eliminarTransaccionManual(id: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = eliminarTransaccionSchema.safeParse({ id });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    const transaccion = await prisma.fondoCondominio.findUnique({
      where: { id },
    });

    if (!transaccion) return { success: false, error: "Transacción no encontrada" };
    if (transaccion.origenTipo !== "MANUAL") return { success: false, error: "Solo se pueden eliminar transacciones manuales" };

    await prisma.gastoCondominio.deleteMany({
      where: { id },
    });

    await prisma.fondoCondominio.delete({
      where: { id },
    });

    revalidatePath("/admin/fondos");
    return { success: true };
  }, "eliminarTransaccionManual");
}
