"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    // Verificar contraseña actual contra Supabase Auth
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email ?? "",
      password: parsed.data.currentPassword,
    });
    if (signInError) {
      return { success: false, error: "La contraseña actual es incorrecta" };
    }

    // Actualizar password en Supabase Auth
    const admin = createAdminClient();
    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { supabaseId: true },
    });

    if (usuario?.supabaseId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(
        usuario.supabaseId,
        { password: parsed.data.newPassword }
      );
      if (updateError) throw new Error(updateError.message);
    }

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