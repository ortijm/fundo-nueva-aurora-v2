import { describe, it, expect } from "vitest";

// ─── Helper que replica la lógica de generarGastosComunes ────────────────────

function calcularMontoGc(
  tipoGc: string | undefined | null,
  montoNuevo: number,
  montoConHistorial: number
): number {
  if (tipoGc === "REDUCIDO") return montoNuevo;
  return montoConHistorial; // NORMAL o cualquier otro valor (backward compat)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("calcularMontoGc", () => {
  const montoNuevo = 15000;
  const montoConHistorial = 25000;

  it("NORMAL retorna montoConHistorial", () => {
    expect(calcularMontoGc("NORMAL", montoNuevo, montoConHistorial)).toBe(25000);
  });

  it("REDUCIDO retorna montoNuevo", () => {
    expect(calcularMontoGc("REDUCIDO", montoNuevo, montoConHistorial)).toBe(15000);
  });

  it("undefined (backward compat) retorna montoConHistorial", () => {
    expect(calcularMontoGc(undefined, montoNuevo, montoConHistorial)).toBe(25000);
  });

  it("null (backward compat) retorna montoConHistorial", () => {
    expect(calcularMontoGc(null, montoNuevo, montoConHistorial)).toBe(25000);
  });

  it("valores montoNuevo/montoConHistorial se pasan desde config", () => {
    // Simula montos personalizados desde ConfiguracionSistema
    expect(calcularMontoGc("NORMAL", 10000, 20000)).toBe(20000);
    expect(calcularMontoGc("REDUCIDO", 10000, 20000)).toBe(10000);
  });

  it("cualquier string que no sea REDUCIDO usa montoConHistorial", () => {
    expect(calcularMontoGc("", montoNuevo, montoConHistorial)).toBe(25000);
    expect(calcularMontoGc("INVALIDO", montoNuevo, montoConHistorial)).toBe(25000);
    expect(calcularMontoGc("normal", montoNuevo, montoConHistorial)).toBe(25000);
  });
});
