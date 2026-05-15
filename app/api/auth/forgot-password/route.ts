import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email";
import { checkRateLimit } from "@/lib/ratelimit";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.toLowerCase()?.trim();

    if (!email) {
      return NextResponse.json({ error: "El email es requerido" }, { status: 400 });
    }

    // Rate limiting por IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit(`forgot-password:${ip}`, "forgot-password");
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.resetIn / 60000);
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${minutes} minutos.` },
        { status: 429 }
      );
    }

    const users = await prisma.usuario.findMany({
      where: { email },
    });

    if (users.length === 0) {
      // No revelar si el email existe o no — respuesta genérica
      return NextResponse.json({ success: true });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("host")}`;
    let emailsSent = 0;

    for (const user of users) {
      if (!user.email) continue;

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.verificationToken.deleteMany({
        where: { identifier: user.id },
      });

      await prisma.verificationToken.create({
        data: {
          identifier: user.id,
          token: resetToken,
          expires,
        },
      });

      const resetUrl = `${appUrl}/reset-password?token=${resetToken}&userId=${user.id}`;
      const emailResult = await sendPasswordResetEmail(user.email, resetUrl);

      if (emailResult.ok) {
        emailsSent++;
      }
    }

    if (emailsSent === 0) {
      return NextResponse.json(
        { error: "Error al enviar el email. Verifica la configuración SMTP." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}