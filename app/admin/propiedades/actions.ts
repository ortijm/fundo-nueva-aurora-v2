"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

const crearParcelaSchema = z.object({
  numero: z.string().min(1, "El número de parcela es requerido"),
  nombre: z.string().optional().default(""),
  sector: z.string().optional().default(""),
  propietarioId: z.string().optional().nullable(),
  superficieM2: z.number().optional().nullable(),
  numeroMedidorAgua: z.string().optional().default(""),
  numeroMedidorLuz: z.string().optional().default(""),
  observaciones: z.string().optional().default(""),
});

export async function crearParcela(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    numero: formData.get("numero") as string,
    nombre: (formData.get("nombre") as string) || "",
    sector: (formData.get("sector") as string) || "",
    propietarioId: (formData.get("propietarioId") as string) || null,
    superficieM2: formData.get("superficieM2") ? parseFloat(formData.get("superficieM2") as string) : null,
    numeroMedidorAgua: (formData.get("numeroMedidorAgua") as string) || "",
    numeroMedidorLuz: (formData.get("numeroMedidorLuz") as string) || "",
    observaciones: (formData.get("observaciones") as string) || "",
  };

  const parsed = crearParcelaSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    await prisma.parcela.create({
      data: parsed.data,
    });
    revalidatePath("/admin/propiedades");
    return { success: true };
  }, "crearParcela");
}

const editarParcelaSchema = z.object({
  parcelaId: z.string().min(1, "ID de parcela requerido"),
  nombre: z.string().optional().default(""),
  sector: z.string().optional().default(""),
  propietarioId: z.string().optional().nullable(),
  superficieM2: z.number().optional().nullable(),
  numeroMedidorAgua: z.string().optional().default(""),
  numeroMedidorLuz: z.string().optional().default(""),
  observaciones: z.string().optional().default(""),
});

export async function editarParcela(parcelaId: string, formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    parcelaId,
    nombre: (formData.get("nombre") as string) || "",
    sector: (formData.get("sector") as string) || "",
    propietarioId: (formData.get("propietarioId") as string) || null,
    superficieM2: formData.get("superficieM2") ? parseFloat(formData.get("superficieM2") as string) : null,
    numeroMedidorAgua: (formData.get("numeroMedidorAgua") as string) || "",
    numeroMedidorLuz: (formData.get("numeroMedidorLuz") as string) || "",
    observaciones: (formData.get("observaciones") as string) || "",
  };

  const parsed = editarParcelaSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    await prisma.parcela.update({
      where: { id: parcelaId },
      data: {
        nombre: parsed.data.nombre,
        sector: parsed.data.sector,
        propietarioId: parsed.data.propietarioId,
        superficieM2: parsed.data.superficieM2,
        numeroMedidorAgua: parsed.data.numeroMedidorAgua,
        numeroMedidorLuz: parsed.data.numeroMedidorLuz,
        observaciones: parsed.data.observaciones,
      },
    });
    revalidatePath("/admin/propiedades");
    return { success: true };
  }, "editarParcela");
}

const crearPropietarioSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es requerido"),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  email: z.string().email("Email inválido").optional().nullable(),
  telefono: z.string().optional().default(""),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export async function crearPropietario(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    username: (formData.get("username") as string)?.trim() || "",
    firstName: (formData.get("firstName") as string)?.trim() || "",
    lastName: (formData.get("lastName") as string)?.trim() || "",
    email: (formData.get("email") as string)?.trim() || null,
    telefono: (formData.get("telefono") as string)?.trim() || "",
    password: formData.get("password") as string || "",
  };

  const parsed = crearPropietarioSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Check existing user before wrapping in withErrorHandling
  const existingUser = await prisma.usuario.findUnique({
    where: { username: parsed.data.username },
  });

  if (existingUser) {
    return { success: false, error: "El nombre de usuario ya existe. Elige otro." };
  }

  return withErrorHandling(async () => {
    const hashed = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.usuario.create({
      data: {
        username: parsed.data.username,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        telefono: parsed.data.telefono,
        password: hashed,
        rol: "PROPIETARIO",
      },
    });
    revalidatePath("/admin/propiedades");
    return { success: true, id: user.id, nombre: `${parsed.data.firstName} ${parsed.data.lastName}`.trim() || parsed.data.username };
  }, "crearPropietario");
}

const editarPropietarioSchema = z.object({
  userId: z.string().min(1, "ID de usuario requerido"),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  email: z.string().email("Email inválido").optional().nullable(),
  telefono: z.string().optional().default(""),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});

export async function editarPropietario(userId: string, formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    userId,
    firstName: (formData.get("firstName") as string)?.trim() || "",
    lastName: (formData.get("lastName") as string)?.trim() || "",
    email: (formData.get("email") as string)?.trim() || null,
    telefono: (formData.get("telefono") as string)?.trim() || "",
    password: (formData.get("password") as string)?.trim() || undefined,
  };

  const parsed = editarPropietarioSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    const data: Record<string, unknown> = {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      telefono: parsed.data.telefono,
    };
    if (parsed.data.password) {
      data.password = await bcrypt.hash(parsed.data.password, 10);
    }
    await prisma.usuario.update({ where: { id: userId }, data });
    revalidatePath("/admin/propiedades");
    return { success: true };
  }, "editarPropietario");
}

const desactivarPropietarioSchema = z.object({
  userId: z.string().min(1, "ID de usuario requerido"),
});

export async function desactivarPropietario(userId: string) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const parsed = desactivarPropietarioSchema.safeParse({ userId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    await prisma.usuario.update({ where: { id: userId }, data: { isActive: false } });
    revalidatePath("/admin/propiedades");
    return { success: true };
  }, "desactivarPropietario");
}
