import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCLP(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatPeriodo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const iso = typeof date === "string" ? date : date.toISOString();
  // Extract year/month from ISO to avoid UTC/local timezone mismatch
  const year = parseInt(iso.slice(0, 4), 10);
  const month = parseInt(iso.slice(5, 7), 10) - 1; // 0-indexed
  const d = new Date(year, month, 1);
  return new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatPeriodoCorto(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const iso = typeof date === "string" ? date : date.toISOString();
  const year = parseInt(iso.slice(0, 4), 10);
  const month = parseInt(iso.slice(5, 7), 10) - 1;
  const d = new Date(year, month, 1);
  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "2-digit",
  }).format(d);
}

export function getPrimerDiaMes(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

export function formatNumber(n: number | string | null | undefined, decimals = 2): string {
  const num = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return num.toFixed(decimals);
}

export function toDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && "toNumber" in (value as object)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Mensaje de resultado del envío de comunicado (Requisito 2 de envio-comunicado-seguro):
 * éxito con destinatarios alcanzados + resumen de errores parciales cuando los hay.
 * Pura y testeable; el componente decide el estilo del toast según haya errores.
 */
export function construirMensajeResultadoEnvio(ok: number, erroresDetalle: string[]): string {
  let msg = `Comunicado enviado a ${ok} destinatario${ok !== 1 ? "s" : ""}`;
  if (erroresDetalle.length > 0) {
    const resumen = erroresDetalle.slice(0, 2).join(" · ");
    const extra = erroresDetalle.length > 2 ? ` y ${erroresDetalle.length - 2} más` : "";
    msg += ` · ${erroresDetalle.length} error${erroresDetalle.length !== 1 ? "es" : ""}: ${resumen}${extra}`;
  }
  return msg;
}
