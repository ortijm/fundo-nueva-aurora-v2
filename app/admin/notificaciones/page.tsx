export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { NotificacionesClient } from "./notificaciones-client";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificacionesPage() {
  const notificaciones = await prisma.notificacion.findMany({
    include: { destinatario: true },
    orderBy: { creado: "desc" },
    take: 100,
  });

  // Requisito 1 (notificaciones-comunicado): multi-select solo con parcelas activas y con propietario
  const parcelasActivas = await prisma.parcela.findMany({
    where: { estado: "ACTIVA", propietarioId: { not: null } },
    select: {
      id: true,
      numero: true,
      nombre: true,
      propietario: { select: { id: true, firstName: true, lastName: true, username: true } },
    },
    orderBy: { numero: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Notificaciones
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Historial de notificaciones enviadas a propietarios.
        </p>
      </div>

      <NotificacionesClient
        notificaciones={notificaciones.map(n => ({
          id: n.id,
          tipo: n.tipo,
          asunto: n.asunto,
          destinatario: `${n.destinatario.firstName} ${n.destinatario.lastName}`.trim() || n.destinatario.username,
          email: n.destinatario.email || null,
          estadoEnvio: n.estadoEnvio,
          leido: n.leido,
          creado: n.creado.toISOString(),
          errorDetalle: n.errorDetalle || null,
        }))}
        parcelasActivas={parcelasActivas.map(p => ({
          id: p.id,
          numero: p.numero,
          nombre: p.nombre,
          propietario: p.propietario
            ? `${p.propietario.firstName} ${p.propietario.lastName}`.trim() || p.propietario.username
            : null,
        }))}
      />
    </div>
  );
}
