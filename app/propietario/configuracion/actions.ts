"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { signOut } from "next-auth/react";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session) return unauthorized();

  const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return withErrorHandling(async () => {
    const user = await prisma.usuario.findUnique({
      where: { id: session.user.id },
    });

    if (!user) return { success: false, error: "Usuario no encontrado" };

    if (!user.password) return { success: false, error: "El usuario no tiene contraseña configurada" };

    const passwordMatch = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!passwordMatch) return { success: false, error: "La contraseña actual es incorrecta" };

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.usuario.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return { success: true };
  }, "changePassword");
}

export async function getProfile() {
  const session = await auth();
  if (!session) return null;

  return withErrorHandling(async () => {
    const user = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        telefono: true,
      },
    });

    if (!user) throw new Error("Usuario no encontrado");
    return user;
  }, "getProfile");
}