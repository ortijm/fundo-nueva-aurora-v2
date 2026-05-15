import { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Iniciar Sesión" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--surface)] px-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: "var(--primary)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: "var(--primary-container)" }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "var(--primary)" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold font-display"
            style={{ color: "var(--on-surface)" }}
          >
            Fundo Nueva Aurora
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
            Gestión de Condominio
          </p>
        </div>

        {/* Card */}
        <div className="card-surface p-8">
          <h2
            className="text-lg font-semibold font-display mb-6"
            style={{ color: "var(--on-surface)" }}
          >
            Iniciar sesión
          </h2>
          <LoginForm />
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: "var(--on-surface-muted)" }}
        >
          © {new Date().getFullYear()} Fundo Nueva Aurora
        </p>
      </div>
    </main>
  );
}
