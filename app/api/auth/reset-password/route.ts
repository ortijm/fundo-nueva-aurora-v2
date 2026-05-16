import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token y nueva contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Token de recuperación inválido o expirado" },
        { status: 400 }
      );
    }

    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { token },
      });
      return NextResponse.json(
        { error: "El token ha expirado. Solicita uno nuevo." },
        { status: 400 }
      );
    }

    const user = await prisma.usuario.findUnique({
      where: { id: verificationToken.identifier },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const supabase = createAdminClient();

    // Actualizar password en Supabase Auth
    if (user.supabaseId) {
      const { error: authError } = await supabase.auth.admin.updateUserById(user.supabaseId, { password });
      if (authError) {
        console.error("Reset password auth error:", authError);
      }
    }

    // También actualizar en BD local
    await prisma.usuario.update({
      where: { id: user.id },
      data: { supabaseId: user.supabaseId || undefined },
    });

    await prisma.verificationToken.delete({
      where: { token },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}