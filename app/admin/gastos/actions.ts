"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generarGastosComunes } from "../consumos/actions";

export { generarGastosComunes };

export async function crearGasto(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const monto = parseFloat(formData.get("monto") as string);
  if (isNaN(monto) || monto <= 0) return { error: "Monto inválido" };

  await prisma.gastoCondominio.create({
    data: {
      nombre: formData.get("nombre") as string,
      categoria: formData.get("categoria") as "MANTENIMIENTO" | "SERVICIOS" | "SERVICIOS_PUBLICOS" | "REPARACION" | "OTRO",
      periodicidad: (formData.get("periodicidad") as "MENSUAL" | "PUNTUAL") || "PUNTUAL",
      proveedor: (formData.get("proveedor") as string) || "",
      monto,
      fechaGasto: new Date(formData.get("fechaGasto") as string),
      notas: (formData.get("notas") as string) || "",
      registradoPorId: session.user.id,
    },
  });

  // Registrar egreso en el fondo
  await prisma.fondoCondominio.create({
    data: {
      tipo: "EGRESO",
      concepto: formData.get("nombre") as string,
      monto,
      fecha: new Date(formData.get("fechaGasto") as string),
      origenTipo: "GASTO",
      registradoPorId: session.user.id,
    },
  });

  revalidatePath("/admin/gastos");
  return { success: true };
}
