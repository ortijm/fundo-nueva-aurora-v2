"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function guardarConfiguracion(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const toNum = (key: string) => {
    const v = parseFloat(formData.get(key) as string);
    return isNaN(v) ? 0 : v;
  };

  await prisma.configuracionSistema.upsert({
    where: { id: 1 },
    create: {
      id: 1,
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
      franquiciaAguaM3: toNum("franquiciaAguaM3"),
      tarifaAgua1_10: toNum("tarifaAgua1_10"),
      tarifaAgua11_20: toNum("tarifaAgua11_20"),
      tarifaAgua21_30: toNum("tarifaAgua21_30"),
      tarifaAgua31_40: toNum("tarifaAgua31_40"),
      tarifaAgua41mas: toNum("tarifaAgua41mas"),
      costoLuzKwh: toNum("costoLuzKwh"),
      montoGcNuevo: toNum("montoGcNuevo"),
      montoGcConHistorial: toNum("montoGcConHistorial"),
      mensajePieEc: (formData.get("mensajePieEc") as string) || "",
    },
    update: {
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
      franquiciaAguaM3: toNum("franquiciaAguaM3"),
      tarifaAgua1_10: toNum("tarifaAgua1_10"),
      tarifaAgua11_20: toNum("tarifaAgua11_20"),
      tarifaAgua21_30: toNum("tarifaAgua21_30"),
      tarifaAgua31_40: toNum("tarifaAgua31_40"),
      tarifaAgua41mas: toNum("tarifaAgua41mas"),
      costoLuzKwh: toNum("costoLuzKwh"),
      montoGcNuevo: toNum("montoGcNuevo"),
      montoGcConHistorial: toNum("montoGcConHistorial"),
      mensajePieEc: (formData.get("mensajePieEc") as string) || "",
    },
  });

  revalidatePath("/admin/configuracion");
  return { success: true };
}
