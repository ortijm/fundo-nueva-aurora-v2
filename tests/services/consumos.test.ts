import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks — usar vi.hoisted para evitar hoisting issues
const mockGetConfig = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockTipoFindUnique = vi.hoisted(() => vi.fn(() => ({ id: "tipo-agua", nombre: "Agua", esVariable: true })));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracionSistema: { findUnique: mockGetConfig },
    tipoConsumo: { findUnique: mockTipoFindUnique },
    consumoMensual: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock("@/lib/services/config", () => ({
  getConfig: mockGetConfig,
}));

import { calcularConsumo } from "../../lib/services/consumos";

describe("calcularConsumo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula consumo de agua con franquicia", async () => {
    mockGetConfig.mockResolvedValue({
      franquiciaAguaM3: 30,
      tarifaAgua1_10: 2000,
      tarifaAgua11_20: 2500,
      tarifaAgua21_30: 3500,
      tarifaAgua31_40: 4000,
      tarifaAgua41mas: 5000,
      costoLuzKwh: 180,
    });

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
    mockGetConfig.mockResolvedValue({
      franquiciaAguaM3: 30,
      tarifaAgua1_10: 2000,
      tarifaAgua11_20: 2500,
      tarifaAgua21_30: 3500,
      tarifaAgua31_40: 4000,
      tarifaAgua41mas: 5000,
      costoLuzKwh: 180,
    });
    mockFindFirst.mockResolvedValue(null);

    const result = await calcularConsumo("parcela-1", "tipo-agua", new Date("2024-01-01"), 100);

    expect(result.lecturaAnterior).toBe(0);
    expect(result.consumoCalculado).toBe(100);
  });

  it("usa lecturaAnteriorOverride si se provee", async () => {
    mockGetConfig.mockResolvedValue({
      franquiciaAguaM3: 30,
      tarifaAgua1_10: 2000,
      tarifaAgua11_20: 2500,
      tarifaAgua21_30: 3500,
      tarifaAgua31_40: 4000,
      tarifaAgua41mas: 5000,
      costoLuzKwh: 180,
    });

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
});
