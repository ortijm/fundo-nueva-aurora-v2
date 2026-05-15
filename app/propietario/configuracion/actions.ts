"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { signOut } from "next-auth/react";

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };

  const user = await prisma.usuario.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return { error: "Usuario no encontrado" };

  if (!user.password) return { error: "El usuario no tiene contraseña configurada" };

  const passwordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatch) return { error: "La contraseña actual es incorrecta" };

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.usuario.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}

export async function getProfile() {
  const session = await auth();
  if (!session) return null;

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

  return user;
}