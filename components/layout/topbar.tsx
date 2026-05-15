"use client";

import { useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

interface TopbarProps {
  userName: string;
  userCargo?: string;
  rol: "ADMINISTRADOR" | "PROPIETARIO";
  notifCount?: number;
}

export function Topbar({ userName, userCargo, rol, notifCount = 0 }: TopbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-nav border-b border-[rgba(0,0,0,0.04)] px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg"
          style={{ color: "var(--on-surface-muted)" }}
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Nueva Aurora
        </span>
        <button className="p-2 rounded-lg relative" style={{ color: "var(--on-surface-muted)" }}>
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--error)]" />
          )}
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-64"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar rol={rol} userName={userName} userCargo={userCargo} />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[var(--surface-low)]"
              style={{ color: "var(--on-surface-muted)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
