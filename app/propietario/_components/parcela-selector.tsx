"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface ParcelaOption {
  id: string;
  numero: string;
  nombre: string;
}

interface ParcelaSelectorProps {
  parcelas: ParcelaOption[];
}

export function ParcelaSelector({ parcelas }: ParcelaSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("parcela") || parcelas[0]?.id || "";

  if (parcelas.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value;
    // Preserve current path, just update parcela param
    const params = new URLSearchParams(searchParams.toString());
    params.set("parcela", newId);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--on-surface-muted)" }}>
        Parcela
      </label>
      <select
        value={selectedId}
        onChange={handleChange}
        className="px-3 py-1.5 text-sm rounded-lg font-medium"
        style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
      >
        {parcelas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.numero}{p.nombre ? ` — ${p.nombre}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
