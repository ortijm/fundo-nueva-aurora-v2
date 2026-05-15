import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./change-password-form";
import { getProfile } from "./actions";
import { User, Mail, Phone, Calendar, Shield } from "lucide-react";

export const metadata: Metadata = { title: "Configuración - Propietario" };

export default async function PropietarioConfiguracionPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const profile = await getProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Configuración
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Gestiona tu cuenta y preferencias.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Perfil */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-surface p-6">
            <div className="flex items-center gap-2 mb-4">
              <User size={18} style={{ color: "var(--primary)" }} />
              <h3 className="text-sm font-semibold font-display" style={{ color: "var(--on-surface)" }}>
                Datos de la Cuenta
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--primary-container)" }}
                >
                  <User size={18} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Nombre</p>
                  <p className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>
                    {profile?.firstName} {profile?.lastName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--secondary-container)" }}
                >
                  <Mail size={18} style={{ color: "var(--secondary)" }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Email</p>
                  <p className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>
                    {profile?.email || "No configurado"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--tertiary-container)" }}
                >
                  <Phone size={18} style={{ color: "var(--tertiary)" }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Teléfono</p>
                  <p className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>
                    {profile?.telefono || "No configurado"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--surface-high)" }}
                >
                  <Calendar size={18} style={{ color: "var(--on-surface-muted)" }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--on-surface-muted)" }}>Usuario</p>
                  <p className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>
                    @{profile?.username}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ChangePasswordForm />
        </div>

        {/* Info lateral */}
        <div className="lg:col-span-1">
          <div className="card-surface p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} style={{ color: "var(--primary)" }} />
              <h3 className="text-sm font-semibold font-display" style={{ color: "var(--on-surface)" }}>
                Seguridad
              </h3>
            </div>

            <div className="space-y-3 text-sm">
              <p style={{ color: "var(--on-surface-muted)" }}>
                Para proteger tu cuenta,建议你使用:
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span style={{ color: "var(--tertiary)" }}>✓</span>
                  <span style={{ color: "var(--on-surface)" }}>Mínimo 6 caracteres</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: "var(--tertiary)" }}>✓</span>
                  <span style={{ color: "var(--on-surface)" }}>Mezcla de letras y números</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: "var(--tertiary)" }}>✓</span>
                  <span style={{ color: "var(--on-surface)" }}>Evitar información personal</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}