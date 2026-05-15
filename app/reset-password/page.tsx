"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm" style={{ color: "#dc2626" }}>
          Token de recuperación inválido o expirado.
        </p>
        <button
          type="button"
          onClick={() => window.location.href = "/forgot-password"}
          className="text-sm font-medium mt-4"
          style={{ color: "#17335a" }}
        >
          Solicitar nuevo enlace
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const fd = new FormData(e.currentTarget);
      const newPassword = fd.get("newPassword") as string;
      const confirmPassword = fd.get("confirmPassword") as string;

      if (!newPassword || newPassword.length < 6) {
        toast.error("La contraseña debe tener al menos 6 caracteres");
        setIsLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error("Las contraseñas no coinciden");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al restablecer contraseña");
      }

      setIsSuccess(true);
      toast.success("Contraseña restablecida exitosamente");

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al restablecer contraseña");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: "#dcfce7" }}
        >
          <CheckCircle2 size={32} style={{ color: "#16a34a" }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--on-surface)" }}>
          ¡Contraseña actualizada!
        </h2>
        <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>
          Serás redirigido al inicio de sesión...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
          Nueva Contraseña
        </label>
        <input
          name="newPassword"
          type="password"
          required
          minLength={6}
          className="w-full px-3 py-2.5 text-sm rounded-xl"
          style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
          placeholder="Mínimo 6 caracteres"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
          Confirmar Contraseña
        </label>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="w-full px-3 py-2.5 text-sm rounded-xl"
          style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
          placeholder="Repite la contraseña"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #17335a 0%, #2563eb 100%)" }}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Lock size={16} />
            Restablecer Contraseña
          </>
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: "#dbeafe" }}
          >
            <Lock size={32} style={{ color: "#17335a" }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--on-surface)" }}>
            Nueva Contraseña
          </h1>
          <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>
            Ingresa tu nueva contraseña.
          </p>
        </div>

        <div style={{ background: "var(--surface-card)", padding: "24px", borderRadius: "12px" }}>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin" style={{ color: "#17335a" }} />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => window.location.href = "/login"}
            className="text-sm"
            style={{ color: "var(--on-surface-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            ← Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
}
