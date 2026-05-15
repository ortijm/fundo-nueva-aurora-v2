"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function crearParcela(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const numero = formData.get("numero") as string;
  const nombre = (formData.get("nombre") as string) || "";
  const sector = (formData.get("sector") as string) || "";
  const propietarioId = (formData.get("propietarioId") as string) || null;
  const superficieM2 = formData.get("superficieM2") ? parseFloat(formData.get("superficieM2") as string) : null;
  const numeroMedidorAgua = (formData.get("numeroMedidorAgua") as string) || "";
  const numeroMedidorLuz = (formData.get("numeroMedidorLuz") as string) || "";
  const observaciones = (formData.get("observaciones") as string) || "";

  if (!numero) return { error: "El número de parcela es requerido" };

  try {
    await prisma.parcela.create({
      data: {
        numero,
        nombre,
        sector,
        propietarioId: propietarioId || null,
        superficieM2,
        numeroMedidorAgua,
        numeroMedidorLuz,
        observaciones,
      },
    });
    revalidatePath("/admin/propiedades");
    return { success: true };
  } catch (e: unknown) {
    if ((e as { code: string }).code === "P2002") return { error: `El número ${numero} ya existe` };
    return { error: "Error al crear parcela" };
  }
}

export async function editarParcela(parcelaId: string, formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const propietarioId = formData.get("propietarioId") as string;

  await prisma.parcela.update({
    where: { id: parcelaId },
    data: {
      nombre: (formData.get("nombre") as string) || "",
      sector: (formData.get("sector") as string) || "",
      propietarioId: propietarioId || null,
      superficieM2: formData.get("superficieM2") ? parseFloat(formData.get("superficieM2") as string) : null,
      numeroMedidorAgua: (formData.get("numeroMedidorAgua") as string) || "",
      numeroMedidorLuz: (formData.get("numeroMedidorLuz") as string) || "",
      observaciones: (formData.get("observaciones") as string) || "",
    },
  });

  revalidatePath("/admin/propiedades");
  return { success: true };
}

export async function crearPropietario(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const username = (formData.get("username") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim() || "";
  const lastName = (formData.get("lastName") as string)?.trim() || "";
  const email = (formData.get("email") as string)?.trim() || null;
  const telefono = (formData.get("telefono") as string)?.trim() || "";
  const password = formData.get("password") as string;

  if (!username) return { error: "El nombre de usuario es requerido" };
  if (!password || password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres" };

  const existingUser = await prisma.usuario.findUnique({
    where: { username },
  });

  if (existingUser) {
    return { error: "El nombre de usuario ya existe. Elige otro." };
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.usuario.create({
      data: {
        username,
        firstName,
        lastName,
        email: email || null,
        telefono,
        password: hashed,
        rol: "PROPIETARIO",
      },
    });
    revalidatePath("/admin/propiedades");
    return { success: true, id: user.id, nombre: `${firstName} ${lastName}`.trim() || username };
  } catch (e: unknown) {
    return { error: "Error al crear propietario" };
  }
}

export async function editarPropietario(userId: string, formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  const firstName = (formData.get("firstName") as string)?.trim() || "";
  const lastName = (formData.get("lastName") as string)?.trim() || "";
  const email = (formData.get("email") as string)?.trim() || null;
  const telefono = (formData.get("telefono") as string)?.trim() || "";
  const password = (formData.get("password") as string)?.trim();

  try {
    const data: Record<string, unknown> = { firstName, lastName, email: email || null, telefono };
    if (password && password.length >= 6) {
      data.password = await bcrypt.hash(password, 10);
    }
    await prisma.usuario.update({ where: { id: userId }, data });
    revalidatePath("/admin/propiedades");
    return { success: true };
  } catch (e: unknown) {
    return { error: "Error al actualizar propietario" };
  }
}

export async function desactivarPropietario(userId: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };

  await prisma.usuario.update({ where: { id: userId }, data: { isActive: false } });
  revalidatePath("/admin/propiedades");
  return { success: true };
}
