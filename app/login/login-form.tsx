"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const username = form.get("username") as string;
    const password = form.get("password") as string;

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      toast.error("Credenciales incorrectas. Intente nuevamente.");
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--on-surface-muted)" }}
        >
          Usuario
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full px-3.5 py-2.5 text-sm rounded-lg focus:outline-none"
          style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
          placeholder="Tu nombre de usuario"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--on-surface-muted)" }}
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full px-3.5 py-2.5 text-sm rounded-lg focus:outline-none"
          style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity mt-2"
        style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)" }}
      >
        {loading ? "Ingresando..." : "Ingresar"}
      </button>

      <div className="mt-4 text-center">
        <a
          href="/forgot-password"
          style={{ color: "#17335a", fontSize: "12px" }}
        >
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </form>
  );
}
