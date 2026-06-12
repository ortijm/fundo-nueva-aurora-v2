import { prisma } from "@/lib/prisma";
import { getConfig } from "./config";
import { formatCLP } from "@/lib/utils";
import { createTransport, escapeHtml } from "@/lib/smtp";

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (!to) return { ok: false, error: "Destinatario sin email" };

  const transport = createTransport();
  if (!transport) return { ok: false, error: "SMTP no configurado en .env (SMTP_HOST, SMTP_USER, SMTP_PASS)" };

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@nuevaaurora.cl";

  try {
    await transport.sendMail({ from, to, subject, html });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("Email error:", msg);
    return { ok: false, error: msg };
  }
}

export async function enviarNotificacionEstadoCuenta(ecId: string): Promise<{ enviado: boolean; error?: string }> {
  const ec = await prisma.estadoCuenta.findUnique({
    where: { id: ecId },
    include: { parcela: { include: { propietario: true } } },
  });

  if (!ec) return { enviado: false, error: "Estado de cuenta no encontrado" };
  if (!ec.parcela.propietario?.email) return { enviado: false, error: "El propietario no tiene email registrado" };

  const config = await getConfig();
  const propietario = ec.parcela.propietario;
  const nombre = `${propietario.firstName} ${propietario.lastName}`.trim() || propietario.username;
  const periodoLabel = ec.periodo.toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #181c1e;">
      <div style="background: #17335a; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; font-size: 20px; margin: 0;">${config.nombreCondominio}</h1>
        <p style="color: #b0c4de; font-size: 13px; margin: 6px 0 0;">Estado de Cuenta — ${periodoLabel}</p>
      </div>
      <div style="background: #f7fafc; border: 1px solid #e8ecef; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="margin: 0 0 16px;">Estimado/a <strong>${escapeHtml(nombre)}</strong>,</p>
        <p style="color: #42484d; margin: 0 0 20px;">Le enviamos el estado de cuenta correspondiente al período <strong>${periodoLabel}</strong> para la parcela <strong>${ec.parcela.numero}</strong>.</p>

        <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #e8ecef;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            ${Number(ec.subtotalAgua) > 0 ? `<tr><td style="padding: 8px 0; color: #42484d; border-bottom: 1px solid #f1f4f6;">Agua</td><td style="text-align: right; font-weight: 600;">${formatCLP(Number(ec.subtotalAgua))}</td></tr>` : ""}
            ${Number(ec.subtotalLuz) > 0 ? `<tr><td style="padding: 8px 0; color: #42484d; border-bottom: 1px solid #f1f4f6;">Luz</td><td style="text-align: right; font-weight: 600;">${formatCLP(Number(ec.subtotalLuz))}</td></tr>` : ""}
            ${Number(ec.subtotalGc) > 0 ? `<tr><td style="padding: 8px 0; color: #42484d; border-bottom: 1px solid #f1f4f6;">Gasto Común</td><td style="text-align: right; font-weight: 600;">${formatCLP(Number(ec.subtotalGc))}</td></tr>` : ""}
            ${Number(ec.deudaAnterior) > 0 ? `<tr><td style="padding: 8px 0; color: #ba1a1a; border-bottom: 1px solid #f1f4f6;">Deuda Anterior</td><td style="text-align: right; font-weight: 600; color: #ba1a1a;">${formatCLP(Number(ec.deudaAnterior))}</td></tr>` : ""}
            <tr style="background: #f1f4f6;">
              <td style="padding: 12px 8px; font-weight: 700; font-size: 16px;">TOTAL A PAGAR</td>
              <td style="text-align: right; font-weight: 700; font-size: 16px; color: #17335a;">${formatCLP(Number(ec.total))}</td>
            </tr>
          </table>
        </div>

        ${config.banco ? `
        <div style="background: #f1f4f6; border-radius: 10px; padding: 16px; margin-bottom: 20px; font-size: 13px;">
          <p style="font-weight: 700; margin: 0 0 8px; color: #17335a;">DATOS DE PAGO</p>
          <p style="margin: 4px 0;">Banco: <strong>${config.banco}</strong></p>
          <p style="margin: 4px 0;">Tipo de cuenta: <strong>${config.tipoCuenta}</strong></p>
          <p style="margin: 4px 0;">Número: <strong>${config.numeroCuenta}</strong></p>
          <p style="margin: 4px 0;">Titular: <strong>${config.nombreTitular}</strong></p>
          <p style="margin: 4px 0;">RUT: <strong>${config.rutTitular}</strong></p>
          <p style="margin: 4px 0;">Email comprobante: <strong>${config.emailPagos}</strong></p>
        </div>` : ""}

        ${config.mensajePieEc ? `<p style="color: #42484d; font-size: 13px; border-top: 1px solid #e8ecef; padding-top: 16px;">${config.mensajePieEc}</p>` : ""}
        <p style="color: #8a9299; font-size: 12px; margin-top: 16px;">${config.nombreCondominio} · ${config.direccion}</p>
        <p style="text-align: center; margin-top: 20px;">
          <a href="https://fundo-nueva-aurora-v2.vercel.app" style="color: #17335a; font-size: 13px; font-weight: 600; text-decoration: none;">
            Ingresar a la plataforma →
          </a>
        </p>
      </div>
    </div>
  `;

  const result = await sendEmail(
    propietario.email!,
    `Estado de Cuenta ${periodoLabel} — Parcela ${ec.parcela.numero} — ${formatCLP(Number(ec.total))}`,
    html,
  );
  return { enviado: result.ok, error: result.error };
}

export async function enviarNotificacionPagoAdmin(pagoId: string): Promise<{ enviado: boolean; error?: string }> {
  const config = await getConfig();
  if (!config.emailPagos) return { enviado: false, error: "emailPagos no configurado en Ajustes del sistema" };

  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: { parcela: { include: { propietario: true } } },
  });
  if (!pago) return { enviado: false, error: "Pago no encontrado" };

  const nombre = pago.parcela.propietario
    ? `${pago.parcela.propietario.firstName} ${pago.parcela.propietario.lastName}`.trim() || pago.parcela.propietario.username
    : "Sin nombre";

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #17335a; font-size: 20px; margin-bottom: 16px;">Nuevo Pago Informado</h2>
      <p style="color: #42484d;">Se ha recibido un nuevo comprobante de pago.</p>
      <div style="background: #f1f4f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p><strong>Parcela:</strong> ${pago.parcela.numero}</p>
        <p><strong>Propietario:</strong> ${escapeHtml(nombre)}</p>
        <p><strong>Monto:</strong> ${formatCLP(Number(pago.monto))}</p>
        ${pago.concepto ? `<p><strong>Concepto:</strong> ${pago.concepto}</p>` : ""}
        <p><strong>Fecha operación:</strong> ${pago.fechaOperacion ? new Date(pago.fechaOperacion).toLocaleDateString("es-CL") : "No informada"}</p>
      </div>
      <p style="color: #42484d; font-size: 13px;">Accede al sistema para validar este pago.</p>
    </div>
  `;

  const result = await sendEmail(config.emailPagos, `NUEVO PAGO — Parcela ${pago.parcela.numero} — ${formatCLP(Number(pago.monto))}`, html);
  return { enviado: result.ok, error: result.error };
}

export async function enviarNotificacionPagoAprobado(pagoId: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: { parcela: { include: { propietario: true } } },
  });

  if (!pago || !pago.parcela.propietario?.email) return;
  const config = await getConfig();

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #003b22; font-size: 20px; margin-bottom: 16px;">✓ Pago Aprobado</h2>
      <p style="color: #42484d;">Tu pago ha sido verificado y aprobado exitosamente.</p>
      <div style="background: #c8f0da; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p><strong>Monto aprobado:</strong> ${formatCLP(Number(pago.monto))}</p>
        <p><strong>Parcela:</strong> ${pago.parcela.numero}</p>
      </div>
      <p style="color: #42484d; font-size: 13px;">${config.nombreCondominio}</p>
    </div>
  `;

  await sendEmail(pago.parcela.propietario.email, `Pago Aprobado — ${formatCLP(Number(pago.monto))} — ${config.nombreCondominio}`, html);
}

export async function enviarNotificacionPagoRechazado(pagoId: string, motivo: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: { parcela: { include: { propietario: true } } },
  });

  if (!pago || !pago.parcela.propietario?.email) return;
  const config = await getConfig();

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="color: #ba1a1a; font-size: 20px; margin-bottom: 16px;">Pago Rechazado</h2>
      <p style="color: #42484d;">Lamentablemente tu pago no pudo ser procesado.</p>
      <div style="background: #ffdad6; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p><strong>Monto:</strong> ${formatCLP(Number(pago.monto))}</p>
        <p><strong>Motivo:</strong> ${motivo}</p>
      </div>
      <p style="color: #42484d; font-size: 13px;">Por favor, vuelve a informar el pago con los datos correctos.</p>
    </div>
  `;

  await sendEmail(pago.parcela.propietario.email, `Pago Rechazado — ${config.nombreCondominio}`, html);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<{ ok: boolean; error?: string }> {
  const config = await getConfig();

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <div style="background: #17335a; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
        <h1 style="color: white; font-size: 20px; margin: 0;">${config.nombreCondominio}</h1>
        <p style="color: #b0c4de; font-size: 13px; margin: 6px 0 0;">Recuperación de Contraseña</p>
      </div>
      <div style="background: #f7fafc; border: 1px solid #e8ecef; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="margin: 0 0 16px;">Hola,</p>
        <p style="color: #42484d; margin: 0 0 20px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${config.nombreCondominio}.</p>
        <p style="color: #42484d; margin: 0 0 20px;">Haz clic en el siguiente botón para crear una nueva contraseña:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #17335a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Restablecer Contraseña</a>
        </div>
        <p style="color: #8a9299; font-size: 12px; margin: 0;">Este enlace expira en 1 hora.</p>
        <p style="color: #8a9299; font-size: 12px; margin-top: 16px;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
        <hr style="border: none; border-top: 1px solid #e8ecef; margin: 24px 0;">
        <p style="color: #8a9299; font-size: 12px; margin: 0;">${config.nombreCondominio} · ${config.direccion}</p>
      </div>
    </div>
  `;

  return sendEmail(email, `Restablecer Contraseña — ${config.nombreCondominio}`, html);
}
