import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks — usar vi.hoisted para evitar hoisting issues
const mockGetConfig = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockParcelaFindUnique = vi.hoisted(() => vi.fn());
const mockTipoFindUnique = vi.hoisted(() => vi.fn(() => ({ id: "tipo-agua", nombre: "Agua", esVariable: true })));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracionSistema: { findUnique: mockGetConfig },
    tipoConsumo: { findUnique: mockTipoFindUnique },
    parcela: { findUnique: mockParcelaFindUnique },
    consumoMensual: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock("@/lib/services/config", () => ({
  getConfig: mockGetConfig,
}));

import { calcularConsumo, calcularMontoAgua } from "../../lib/services/consumos";

const configBase = {
  tarifaAgua1_10: 2000,
  tarifaAgua11_20: 2500,
  tarifaAgua21_30: 3500,
  tarifaAgua31_40: 4000,
  tarifaAgua41mas: 5000,
  costoLuzKwh: 180,
};

describe("calcularConsumo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParcelaFindUnique.mockResolvedValue({ id: "parcela-1", franquiciaAgua: "M3_30" });
  });

  it("calcula consumo de agua con franquicia M3_30 (50m³ consumidos, 20 de sobreconsumo)", async () => {
    mockGetConfig.mockResolvedValue(configBase);

    mockFindFirst.mockResolvedValue({
      lecturaActual: 100,
      periodo: new Date("2024-01-01"),
    });

    const result = await calcularConsumo(
      "parcela-1",
      "tipo-agua",
      new Date("2024-02-01"),
      150,
    );

    expect(result.montoConsumo).toBeGreaterThan(0);
    expect(result.consumoCalculado).toBe(50); // 150 - 100 = 50m³
    expect(result.lecturaAnterior).toBe(100);
    expect(result.lecturaActual).toBe(150);
  });

  it("usa 0 como lectura anterior si no hay registro previo", async () => {
    mockGetConfig.mockResolvedValue(configBase);
    mockFindFirst.mockResolvedValue(null);

    const result = await calcularConsumo("parcela-1", "tipo-agua", new Date("2024-01-01"), 100);

    expect(result.lecturaAnterior).toBe(0);
    expect(result.consumoCalculado).toBe(100);
  });

  it("usa lecturaAnteriorOverride si se provee", async () => {
    mockGetConfig.mockResolvedValue(configBase);

    const result = await calcularConsumo(
      "parcela-1",
      "tipo-agua",
      new Date("2024-02-01"),
      150,
      50,
    );

    expect(result.lecturaAnterior).toBe(50);
    expect(result.consumoCalculado).toBe(100);
  });

  it("Escenario 1: parcela M3_15 con lectura 18 factura solo el exceso (3 m³)", async () => {
    mockGetConfig.mockResolvedValue(configBase);
    mockParcelaFindUnique.mockResolvedValue({ id: "parcela-1", franquiciaAgua: "M3_15" });

    const result = await calcularConsumo("parcela-1", "tipo-agua", new Date("2024-02-01"), 18, 0);

    expect(result.consumoCalculado).toBe(18);
    expect(result.montoConsumo).toBe(3 * 2000); // 18 - 15 = 3 m³ a tarifa t1_10
    expect(result.totalAPagar).toBe(6000);
  });

  it("Escenario 2: parcela M3_30 con lectura 25 dentro del límite → 0 facturables", async () => {
    mockGetConfig.mockResolvedValue(configBase);

    const result = await calcularConsumo("parcela-1", "tipo-agua", new Date("2024-02-01"), 25, 0);

    expect(result.consumoCalculado).toBe(25);
    expect(result.montoConsumo).toBe(0);
    expect(result.totalAPagar).toBe(0);
  });

  it("no hace findUnique extra cuando se pasa parcelaCargada (Escenario 6)", async () => {
    mockGetConfig.mockResolvedValue(configBase);

    const result = await calcularConsumo(
      "parcela-1",
      "tipo-agua",
      new Date("2024-02-01"),
      30,
      10,
      { id: "parcela-1", franquiciaAgua: "M3_30" },
    );

    expect(mockParcelaFindUnique).not.toHaveBeenCalled();
    expect(result.montoConsumo).toBe(0); // 30 - 10 = 20m³ consumidos, franquicia 30 → 0
  });

  it("lanza error si la parcela no existe en el fallback findUnique", async () => {
    mockGetConfig.mockResolvedValue(configBase);
    mockParcelaFindUnique.mockResolvedValue(null);

    await expect(calcularConsumo("parcela-inexistente", "tipo-agua", new Date("2024-02-01"), 50, 0))
      .rejects.toThrow("Parcela no encontrada");
  });
});

describe("calcularMontoAgua", () => {
  it("devuelve 0 cuando el consumo está dentro de la franquicia", () => {
    expect(calcularMontoAgua(10, 30, configBase)).toBe(0);
  });

  it("factura el exceso con la tarifa del primer tramo (≤ 10 m³)", () => {
    expect(calcularMontoAgua(18, 15, configBase)).toBe(3 * 2000);
  });

  it("factura el exceso con la tarifa del tramo superior (≥ 41 m³)", () => {
    expect(calcularMontoAgua(60, 15, configBase)).toBe(45 * 5000);
  });
});
