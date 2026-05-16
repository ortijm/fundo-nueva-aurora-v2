"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Credenciales incorrectas. Intente nuevamente.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--on-surface-muted)" }}
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-3.5 py-2.5 text-sm rounded-lg focus:outline-none"
          style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
          placeholder="tu@email.com"
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
