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
      />
    </div>
  );
}
