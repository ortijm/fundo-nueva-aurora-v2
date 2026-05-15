"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { changePassword } from "./actions";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const currentPassword = fd.get("currentPassword") as string;
    const newPassword = fd.get("newPassword") as string;
    const confirmPassword = fd.get("confirmPassword") as string;

    if (!currentPassword) {
      toast.error("Ingresa tu contraseña actual");
      return;
    }

    if (!newPassword) {
      toast.error("Ingresa la nueva contraseña");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    startTransition(() => {
      toast.promise(changePassword(currentPassword, newPassword), {
        loading: "Cambiando contraseña...",
        success: (res) => {
          if (res.error) throw new Error(res.error);
          formRef.current?.reset();
          return "Contraseña cambiada exitosamente";
        },
        error: (err) => err.message || "Error al cambiar contraseña",
      });
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="card-surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-semibold font-display" style={{ color: "var(--on-surface)" }}>
            Cambiar Contraseña
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Contraseña Actual
            </label>
            <div className="relative">
              <input
                name="currentPassword"
                type={showCurrent ? "text" : "password"}
                required
                className="w-full px-3 py-2.5 text-sm rounded-xl pr-10"
                style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showCurrent ? (
                  <EyeOff size={16} style={{ color: "var(--on-surface-muted)" }} />
                ) : (
                  <Eye size={16} style={{ color: "var(--on-surface-muted)" }} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                name="newPassword"
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                className="w-full px-3 py-2.5 text-sm rounded-xl pr-10"
                style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showNew ? (
                  <EyeOff size={16} style={{ color: "var(--on-surface-muted)" }} />
                ) : (
                  <Eye size={16} style={{ color: "var(--on-surface-muted)" }} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <input
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                className="w-full px-3 py-2.5 text-sm rounded-xl pr-10"
                style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                placeholder="Repite la nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showConfirm ? (
                  <EyeOff size={16} style={{ color: "var(--on-surface-muted)" }} />
                ) : (
                  <Eye size={16} style={{ color: "var(--on-surface-muted)" }} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
      >
        <Lock size={16} />
        {isPending ? "Guardando..." : "Cambiar Contraseña"}
      </button>
    </form>
  );
}