"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

const guardarConfiguracionSchema = z.object({
  nombreCondominio: z.string().optional().default("Condominio Nueva Aurora"),
  rutCondominio: z.string().optional().default(""),
  direccion: z.string().optional().default(""),
  telefono: z.string().optional().default(""),
  emailContacto: z.string().optional().default(""),
  banco: z.string().optional().default(""),
  tipoCuenta: z.string().optional().default(""),
  numeroCuenta: z.string().optional().default(""),
  emailPagos: z.string().optional().default(""),
  rutTitular: z.string().optional().default(""),
  nombreTitular: z.string().optional().default(""),
  franquiciaAguaM3: z.number().optional().default(0),
  tarifaAgua1_10: z.number().optional().default(0),
  tarifaAgua11_20: z.number().optional().default(0),
  tarifaAgua21_30: z.number().optional().default(0),
  tarifaAgua31_40: z.number().optional().default(0),
  tarifaAgua41mas: z.number().optional().default(0),
  costoLuzKwh: z.number().optional().default(0),
  montoGcNuevo: z.number().optional().default(0),
  montoGcConHistorial: z.number().optional().default(0),
  mensajePieEc: z.string().optional().default(""),
});

const toNum = (val: string | null): number => {
  if (!val) return 0;
  const v = parseFloat(val);
  return isNaN(v) ? 0 : v;
};

export async function guardarConfiguracion(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    nombreCondominio: (formData.get("nombreCondominio") as string) || "Condominio Nueva Aurora",
    rutCondominio: (formData.get("rutCondominio") as string) || "",
    direccion: (formData.get("direccion") as string) || "",
    telefono: (formData.get("telefono") as string) || "",
    emailContacto: (formData.get("emailContacto") as string) || "",
    banco: (formData.get("banco") as string) || "",
    tipoCuenta: (formData.get("tipoCuenta") as string) || "",
    numeroCuenta: (formData.get("numeroCuenta") as string) || "",
    emailPagos: (formData.get("emailPagos") as string) || "",
    rutTitular: (formData.get("rutTitular") as string) || "",
    nombreTitular: (formData.get("nombreTitular") as string) || "",
    franquiciaAguaM3: toNum(formData.get("franquiciaAguaM3") as string),
    tarifaAgua1_10: toNum(formData.get("tarifaAgua1_10") as string),
    tarifaAgua11_20: toNum(formData.get("tarifaAgua11_20") as string),
    tarifaAgua21_30: toNum(formData.get("tarifaAgua21_30") as string),
    tarifaAgua31_40: toNum(formData.get("tarifaAgua31_40") as string),
    tarifaAgua41mas: toNum(formData.get("tarifaAgua41mas") as string),
    costoLuzKwh: toNum(formData.get("costoLuzKwh") as string),
    montoGcNuevo: toNum(formData.get("montoGcNuevo") as string),
    montoGcConHistorial: toNum(formData.get("montoGcConHistorial") as string),
    mensajePieEc: (formData.get("mensajePieEc") as string) || "",
  };

  const parsed = guardarConfiguracionSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    await prisma.configuracionSistema.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...parsed.data,
      },
      update: parsed.data,
    });

    revalidatePath("/admin/configuracion");
    return { success: true };
  }, "guardarConfiguracion");
}
