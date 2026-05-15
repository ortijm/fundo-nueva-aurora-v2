"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generarGastosComunes } from "../consumos/actions";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

export { generarGastosComunes };

const crearGastoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  categoria: z.enum(["MANTENIMIENTO", "SERVICIOS", "SERVICIOS_PUBLICOS", "REPARACION", "OTRO"]),
  periodicidad: z.enum(["MENSUAL", "PUNTUAL"]).optional().default("PUNTUAL"),
  proveedor: z.string().optional().default(""),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  fechaGasto: z.string().transform((val) => new Date(val)),
  notas: z.string().optional().default(""),
});

export async function crearGasto(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    nombre: formData.get("nombre") as string,
    categoria: formData.get("categoria") as "MANTENIMIENTO" | "SERVICIOS" | "SERVICIOS_PUBLICOS" | "REPARACION" | "OTRO",
    periodicidad: (formData.get("periodicidad") as "MENSUAL" | "PUNTUAL") || "PUNTUAL",
    proveedor: (formData.get("proveedor") as string) || "",
    monto: parseFloat(formData.get("monto") as string),
    fechaGasto: formData.get("fechaGasto") as string,
    notas: (formData.get("notas") as string) || "",
  };

  const parsed = crearGastoSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    await prisma.gastoCondominio.create({
      data: {
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        periodicidad: parsed.data.periodicidad,
        proveedor: parsed.data.proveedor,
        monto: parsed.data.monto,
        fechaGasto: parsed.data.fechaGasto,
        notas: parsed.data.notas,
        registradoPorId: session.user.id,
      },
    });

    // Registrar egreso en el fondo
    await prisma.fondoCondominio.create({
      data: {
        tipo: "EGRESO",
        concepto: parsed.data.nombre,
        monto: parsed.data.monto,
        fecha: parsed.data.fechaGasto,
        origenTipo: "GASTO",
        registradoPorId: session.user.id,
      },
    });

    revalidatePath("/admin/gastos");
    return { success: true };
  }, "crearGasto");
}
