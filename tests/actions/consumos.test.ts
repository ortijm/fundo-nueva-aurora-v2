import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks — vi.hoisted para evitar hoisting issues (patrón tests/actions/propiedades.test.ts)
const mockAuth = vi.hoisted(() => vi.fn());
const mockParcelaFindUnique = vi.hoisted(() => vi.fn());
const mockTipoFindFirst = vi.hoisted(() => vi.fn());
const mockConsumoFindUnique = vi.hoisted(() => vi.fn());
const mockConsumoUpsert = vi.hoisted(() => vi.fn());
const mockCalcularConsumo = vi.hoisted(() => vi.fn());
const mockActualizarDeudas = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    parcela: { findUnique: mockParcelaFindUnique },
    tipoConsumo: { findFirst: mockTipoFindFirst },
    consumoMensual: { findUnique: mockConsumoFindUnique, upsert: mockConsumoUpsert },
  },
}));

vi.mock("@/lib/services/consumos", () => ({
  calcularConsumo: mockCalcularConsumo,
  actualizarDeudasParcela: mockActualizarDeudas,
}));

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { importarExcelConsumos, guardarLectura } from "../../app/admin/consumos/actions";

const sessionAdmin = { user: { id: "admin-1", rol: "ADMINISTRADOR", name: "Admin" } };

const calcResult = {
  lecturaAnterior: 50,
  lecturaActual: 80,
  consumoCalculado: 30,
  tarifaAplicada: 0,
  montoConsumo: 0,
  cargoFijo: 0,
  totalAPagar: 0,
};

describe("importarExcelConsumos — guardia estado ≠ PENDIENTE (Decisión 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(sessionAdmin);
    mockParcelaFindUnique.mockResolvedValue({ id: "p1", numero: "A-101", franquiciaAgua: "M3_30" });
    mockTipoFindFirst.mockResolvedValue({ id: "t1" });
    mockCalcularConsumo.mockResolvedValue(calcResult);
  });

  it("rechaza reimport sobre consumo CON_ESTADO_CUENTA: error por fila, sin sobrescribir", async () => {
    mockConsumoFindUnique.mockResolvedValue({ estado: "CON_ESTADO_CUENTA" });

    const res = await importarExcelConsumos([
      { parcelaNumero: "A-101", tipoConsumoId: "t1", periodo: "2025-01", lecturaActual: 80, lecturaAnterior: 50 },
    ]);
    const d = res.data as unknown as { ok: number; errores: string[] };

    expect(d.ok).toBe(0);
    expect(d.errores).toHaveLength(1);
    expect(d.errores[0]).toContain("A-101");
    expect(mockConsumoUpsert).not.toHaveBeenCalled();
    expect(mockCalcularConsumo).not.toHaveBeenCalled();
  });

  it("fila PENDIENTE corregible vía lecturaAnteriorOverride: pasa override y hace upsert", async () => {
    mockConsumoFindUnique.mockResolvedValue({ estado: "PENDIENTE" });

    const res = await importarExcelConsumos([
      { parcelaNumero: "A-101", tipoConsumoId: "t1", periodo: "2025-01", lecturaActual: 80, lecturaAnterior: 50 },
    ]);
    const d = res.data as unknown as { ok: number; errores: string[] };

    expect(d.ok).toBe(1);
    expect(d.errores).toHaveLength(0);
    expect(mockConsumoUpsert).toHaveBeenCalledTimes(1);
    // lecturaAnterior del excel debe llegar como override (5º arg) y la parcela ya cargada (6º arg)
    expect(mockCalcularConsumo).toHaveBeenCalledWith(
      "p1",
      "t1",
      new Date("2025-01-01"),
      80,
      50,
      expect.objectContaining({ id: "p1", franquiciaAgua: "M3_30" }),
    );
  });
});

describe("guardarLectura — guardia estado ≠ PENDIENTE (Decisión 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(sessionAdmin);
    mockCalcularConsumo.mockResolvedValue(calcResult);
  });

  it("rechaza upsert sobre consumo CON_ESTADO_CUENTA", async () => {
    mockConsumoFindUnique.mockResolvedValue({ estado: "CON_ESTADO_CUENTA" });

    const fd = new FormData();
    fd.set("parcelaId", "p1");
    fd.set("tipoConsumoId", "t1");
    fd.set("periodo", "2025-01");
    fd.set("lecturaActual", "80");

    const res = await guardarLectura(fd);
    expect(res.success).toBe(false);
    expect(res.error).toContain("asociado a un estado de cuenta");
    expect(mockConsumoUpsert).not.toHaveBeenCalled();
    expect(mockCalcularConsumo).not.toHaveBeenCalled();
  });

  it("permite upsert sobre consumo PENDIENTE", async () => {
    mockConsumoFindUnique.mockResolvedValue({ estado: "PENDIENTE" });
    mockConsumoUpsert.mockResolvedValue({ id: "c1" });

    const fd = new FormData();
    fd.set("parcelaId", "p1");
    fd.set("tipoConsumoId", "t1");
    fd.set("periodo", "2025-01");
    fd.set("lecturaActual", "80");

    const res = await guardarLectura(fd);
    expect(res.success).toBe(true);
    expect(mockConsumoUpsert).toHaveBeenCalledTimes(1);
  });
});
