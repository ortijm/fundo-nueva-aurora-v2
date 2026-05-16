import { describe, it, expect } from "vitest";
import { formatCLP, formatDate, formatPeriodo, formatPeriodoCorto, toDecimal, formatNumber } from "../lib/utils";

describe("formatCLP", () => {
  it("formatea número en pesos chilenos", () => {
    expect(formatCLP(15000)).toBe("$15.000");
  });

  it("formatea string numérico", () => {
    expect(formatCLP("25000")).toBe("$25.000");
  });

  it("maneja null", () => {
    expect(formatCLP(null)).toBe("$0");
  });

  it("maneja undefined", () => {
    expect(formatCLP(undefined)).toBe("$0");
  });

  it("formatea 0 correctamente", () => {
    expect(formatCLP(0)).toBe("$0");
  });
});

describe("formatDate", () => {
  it("formatea Date", () => {
    const d = new Date(2024, 0, 15); // 15 enero 2024
    expect(formatDate(d)).toMatch(/15/);
    expect(formatDate(d)).toMatch(/ene/);
  });

  it("formatea string ISO", () => {
    const result = formatDate("2024-06-15");
    expect(result).toMatch(/jun/);
    expect(result).toMatch(/2024/);
  });

  it("maneja null", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatPeriodo", () => {
  it("formatea período largo", () => {
    const d = new Date(2024, 2, 1); // marzo 2024
    expect(formatPeriodo(d)).toMatch(/marzo.*2024/);
  });
});

describe("formatPeriodoCorto", () => {
  it("formatea período corto", () => {
    const d = new Date(2024, 2, 1);
    const result = formatPeriodoCorto(d);
    expect(result).toMatch(/mar/);
    expect(result).toMatch(/24/);
  });
});

describe("toDecimal", () => {
  it("convierte número", () => {
    expect(toDecimal(42)).toBe(42);
  });

  it("convierte string", () => {
    expect(toDecimal("42.5")).toBe(42.5);
  });

  it("maneja null", () => {
    expect(toDecimal(null)).toBe(0);
  });

  it("maneja undefined", () => {
    expect(toDecimal(undefined)).toBe(0);
  });
});

describe("formatNumber", () => {
  it("formatea con 2 decimales por defecto", () => {
    expect(formatNumber(42.5)).toBe("42.50");
  });

  it("formatea con decimales personalizados", () => {
    expect(formatNumber(42.567, 1)).toBe("42.6");
  });

  it("maneja null", () => {
    expect(formatNumber(null)).toBe("0.00");
  });
});
