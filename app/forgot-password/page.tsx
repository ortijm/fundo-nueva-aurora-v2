"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const fd = new FormData(e.currentTarget);
    const emailValue = (fd.get("email") as string).trim();

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al procesar la solicitud");
      }

      setEmail(emailValue);
      setEmailSent(true);
    } catch (error) {
      console.error("Forgot password error:", error);
      toast.error(error instanceof Error ? error.message : "Error al enviar el correo");
    } finally {
      setIsLoading(false);
    }
  }

  function goBack() {
    window.location.href = "/login";
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "#dcfce7" }}
            >
              <Mail size={32} style={{ color: "#16a34a" }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--on-surface)" }}>
              Correo enviado
            </h1>
            <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>
              Hemos enviado un enlace de recuperación a <strong>{email}</strong>
            </p>
          </div>

          <div style={{ background: "var(--surface-card)", padding: "24px", borderRadius: "12px", textAlign: "center" }}>
            <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>
              Revisa tu bandeja de entrada y sigue las instrucciones.
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={goBack}
              style={{ color: "#17335a", background: "none", border: "none", cursor: "pointer", fontSize: "14px", textDecoration: "underline" }}
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: "#dbeafe" }}
          >
            <Mail size={32} style={{ color: "#17335a" }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--on-surface)" }}>
            ¿Olvidaste tu contraseña?
          </h1>
          <p className="text-sm" style={{ color: "var(--on-surface-muted)" }}>
            Ingresa tu correo electrónico y te enviaremos un enlace.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "var(--surface-card)", padding: "24px", borderRadius: "12px" }}>
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--on-surface-muted)" }}>
              Correo Electrónico
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-3 py-2.5 text-sm rounded-xl"
              style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
              placeholder="tu@correo.com"
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
                Enviando...
              </>
            ) : (
              "Enviar enlace de recuperación"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={goBack}
            style={{ color: "var(--on-surface-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}
          >
            ← Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
}
