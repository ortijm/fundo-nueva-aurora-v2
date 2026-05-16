"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Zap,
  Receipt,
  CheckSquare,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  HelpCircle,
  Home,
  CreditCard,
  FileText,
  Wallet,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  rol: "ADMINISTRADOR" | "PROPIETARIO";
  userName: string;
  userCargo?: string;
}

const adminNavItems = [
  { href: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/consumos", label: "Consumos", icon: Zap },
  { href: "/admin/gastos", label: "Gastos Comunes", icon: Receipt },
  { href: "/admin/validacion", label: "Validación", icon: CheckSquare },
  { href: "/admin/informar-pago", label: "Informar Pago", icon: CreditCard },
  { href: "/admin/propiedades", label: "Propiedades", icon: Building2 },
  { href: "/admin/estados-cuenta", label: "Estados de Cuenta", icon: FileText },
  { href: "/admin/fondos", label: "Fondos", icon: Wallet },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
];

const propietarioNavItems = [
  { href: "/propietario/dashboard", label: "Inicio", icon: Home },
  { href: "/propietario/informar-pago", label: "Informar Pago", icon: CreditCard },
  { href: "/propietario/estados-cuenta", label: "Estados de Cuenta", icon: FileText },
  { href: "/propietario/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar({ rol, userName, userCargo }: SidebarProps) {
  const pathname = usePathname();
  const navItems = rol === "ADMINISTRADOR" ? adminNavItems : propietarioNavItems;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 flex flex-col border-r border-[rgba(0,0,0,0.04)] bg-[var(--surface-card)]">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-[rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold font-display" style={{ color: "var(--on-surface)" }}>
              CondoAdmin
            </p>
            <p className="text-[10px]" style={{ color: "var(--on-surface-muted)" }}>
              {rol === "ADMINISTRADOR" ? "Gestión Residencial" : "Portal Propietario"}
            </p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-[rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl" style={{ background: "var(--surface-low)" }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: "var(--primary)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--on-surface)" }}>
              {userName}
            </p>
            <p className="text-[10px] truncate" style={{ color: "var(--on-surface-muted)" }}>
              {userCargo || (rol === "ADMINISTRADOR" ? "Administrador" : "Propietario")}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "text-white"
                      : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                  )}
                  style={
                    isActive
                      ? { background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }
                      : {}
                  }
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-[rgba(0,0,0,0.04)] space-y-0.5">
        {rol === "ADMINISTRADOR" && (
          <Link
            href="/admin/configuracion"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
              pathname.startsWith("/admin/configuracion")
                ? "text-white"
                : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
            )}
            style={
              pathname.startsWith("/admin/configuracion")
                ? { background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }
                : {}
            }
          >
            <Settings size={16} />
            Configuración
          </Link>
        )}
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-[var(--on-surface-muted)] hover:text-[var(--error)] hover:bg-[var(--error-container)]"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
