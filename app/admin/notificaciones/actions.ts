"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getConfig } from "@/lib/services/config";
import { z } from "zod";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";
import { createTransport, escapeHtml } from "@/lib/smtp";
import { checkRateLimit } from "@/lib/ratelimit";
import { resolverDestinatarios } from "@/lib/services/notificaciones";

async function enviarComunicadoEmail(
  to: string,
  asunto: string,
  mensaje: string,
  nombreCondominio: string,
  nombreDestinatario: string
): Promise<{ ok: boolean; error?: string }> {
  const transport = createTransport();
  if (!transport) return { ok: false, error: "SMTP no configurado" };

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@nuevaaurora.cl";

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #181c1e;">
      <div style="background: #17335a; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; font-size: 20px; margin: 0;">${nombreCondominio}</h1>
        <p style="color: #b0c4de; font-size: 13px; margin: 6px 0 0;">Comunicado</p>
      </div>
      <div style="background: #f7fafc; border: 1px solid #e8ecef; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="margin: 0 0 16px;">Estimado/a <strong>${escapeHtml(nombreDestinatario)}</strong>,</p>
        <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #e8ecef;">
          <h2 style="font-size: 16px; color: #17335a; margin: 0 0 12px;">${escapeHtml(asunto)}</h2>
          <p style="color: #42484d; font-size: 14px; white-space: pre-wrap; margin: 0;">${escapeHtml(mensaje)}</p>
        </div>
        <p style="color: #8a9299; font-size: 12px; margin-top: 16px;">${nombreCondominio}</p>
      </div>
    </div>
  `;

  try {
    await transport.sendMail({ from, to, subject: asunto, html });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("Comunicado email error:", msg);
    return { ok: false, error: msg };
  }
}

const enviarComunicadoSchema = z.object({
  asunto: z.string().min(1, "Asunto requerido"),
  mensaje: z.string().min(1, "Mensaje requerido"),
  destinatarios: z.enum(["todos", "morosos", "parcelas"]),
  parcelaIds: z.array(z.string().min(1)).optional(),
});

export async function enviarComunicadoAction(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return unauthorized();

  const rawData = {
    asunto: (formData.get("asunto") as string)?.trim() || "",
    mensaje: (formData.get("mensaje") as string)?.trim() || "",
    destinatarios: formData.get("destinatarios") as string || "",
    parcelaIds: (formData.getAll("parcelaIds") as string[]).map((id) => id.trim()).filter(Boolean),
  };

  const parsed = enviarComunicadoSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { asunto, mensaje, destinatarios: opcion, parcelaIds } = parsed.data;

  if (opcion === "parcelas" && (!parcelaIds || parcelaIds.length === 0)) {
    return { success: false, error: "Selecciona al menos una parcela" };
  }

  return withErrorHandling(async () => {
    // Rate-limit al inicio (Decisión 5): 5 intentos / 15 min por usuario y por acción
    const rateCheck = await checkRateLimit(`enviar-comunicado:${session.user.id}`, "enviar-comunicado");
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.resetIn / 60000);
      throw new Error(`Demasiados intentos. Intenta de nuevo en ${minutes} minutos.`);
    }

    const config = await getConfig();
    const destinatarios = await resolverDestinatarios(opcion, parcelaIds);

    let ok = 0;
    let errores = 0;
    const erroresDetalle: string[] = [];

    for (const d of destinatarios) {
      const u = d.usuario;
      const nombre = `${u.firstName} ${u.lastName}`.trim() || u.username;
      let estadoEnvio: "ENVIADO" | "ERROR" | "PENDIENTE" = "PENDIENTE";
      let errorDetalle: string | null = null;

      try {
        if (u.email) {
          const result = await enviarComunicadoEmail(u.email, asunto, mensaje, config.nombreCondominio, nombre);
          estadoEnvio = result.ok ? "ENVIADO" : "ERROR";
          errorDetalle = result.error || null;
          if (result.ok) {
            ok++;
          } else {
            errores++;
            erroresDetalle.push(`${nombre}: ${result.error || "Error al enviar"}`);
          }
        } else {
          // Requisito 7: usuario sin email → Notificacion ERROR sin abortar el resto
          estadoEnvio = "ERROR";
          errorDetalle = "Sin email registrado";
          errores++;
          erroresDetalle.push(`${nombre}: Sin email registrado`);
        }
      } catch (e) {
        estadoEnvio = "ERROR";
        errorDetalle = e instanceof Error ? e.message : "Error desconocido";
        errores++;
        erroresDetalle.push(`${nombre}: ${errorDetalle}`);
      }

      await prisma.notificacion.create({
        data: {
          destinatarioId: u.id,
          tipo: "COMUNICADO",
          asunto,
          mensaje,
          parcelaId: d.parcelaId,
          estadoEnvio,
          errorDetalle,
        },
      });
    }

    revalidatePath("/admin/notificaciones");
    return { success: true, ok, errores, erroresDetalle };
  }, "enviarComunicadoAction");
}
