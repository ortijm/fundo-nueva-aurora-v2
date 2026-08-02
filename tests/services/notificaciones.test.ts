import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPeriodoGastoFindFirst = vi.hoisted(() => vi.fn());
const mockParcelaFindMany = vi.hoisted(() => vi.fn());
const mockUsuarioFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodoGasto: { findFirst: mockPeriodoGastoFindFirst },
    parcela: { findMany: mockParcelaFindMany },
    usuario: { findMany: mockUsuarioFindMany },
  },
}));

import { resolverDestinatarios } from "../../lib/services/notificaciones";

const propietario = (id: string, email: string | null, firstName: string, lastName: string, username: string) => ({
  id,
  email,
  firstName,
  lastName,
  username,
});

const parcela = (
  id: string,
  numero: string,
  deudaTotal: number,
  prop: ReturnType<typeof propietario>
) => ({
  id,
  numero,
  deudaTotal,
  propietario: prop,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolverDestinatarios - morosos", () => {
  it("Escenario 2: incluye la parcela con deudaTotal > 0 (sin PeriodoGasto → solo deuda)", async () => {
    mockPeriodoGastoFindFirst.mockResolvedValue(null);
    mockParcelaFindMany.mockResolvedValue([
      parcela("p1", "01", 50000, propietario("u1", "ana@x.cl", "Ana", "G", "ana")),
    ]);

    const result = await resolverDestinatarios("morosos");

    expect(result).toHaveLength(1);
    expect(result[0].usuario.id).toBe("u1");
    expect(result[0].parcelaId).toBe("p1");

    // Sin PeriodoGasto → la condición de EC queda inactiva: OR con una sola rama
    const args = mockParcelaFindMany.mock.calls[0]?.[0];
    expect(args.where.estado).toBe("ACTIVA");
    expect(args.where.propietarioId).toEqual({ not: null });
    expect(args.where.OR).toEqual([{ deudaTotal: { gt: 0 } }]);
  });

  it("Escenario 3: deudaTotal 0 + EC EMITIDO en el período actual → considerada morosa", async () => {
    const periodoActual = new Date("2025-01-01");
    mockPeriodoGastoFindFirst.mockResolvedValue({ periodo: periodoActual });
    mockParcelaFindMany.mockResolvedValue([
      parcela("p2", "02", 0, propietario("u2", "beto@x.cl", "Beto", "R", "beto")),
    ]);

    const result = await resolverDestinatarios("morosos");

    expect(result).toHaveLength(1);
    expect(result[0].usuario.id).toBe("u2");
    expect(result[0].parcelaId).toBe("p2");

    const args = mockParcelaFindMany.mock.calls[0]?.[0];
    expect(args.where.OR).toEqual([
      { deudaTotal: { gt: 0 } },
      { estadosCuenta: { some: { estado: "EMITIDO", periodo: periodoActual } } },
    ]);
  });

  it("Escenario 4: propietario con 2 parcelas morosas recibe UNA notificación; parcelaId = mayor deudaTotal", async () => {
    mockPeriodoGastoFindFirst.mockResolvedValue(null);
    mockParcelaFindMany.mockResolvedValue([
      parcela("p1", "01", 30000, propietario("u1", "ana@x.cl", "Ana", "G", "ana")),
      parcela("p2", "02", 80000, propietario("u1", "ana@x.cl", "Ana", "G", "ana")),
      parcela("p3", "03", 50000, propietario("u2", "beto@x.cl", "Beto", "R", "beto")),
    ]);

    const result = await resolverDestinatarios("morosos");

    expect(result).toHaveLength(2);
    const ana = result.find((r) => r.usuario.id === "u1");
    const beto = result.find((r) => r.usuario.id === "u2");
    expect(ana?.parcelaId).toBe("p2"); // mayor deudaTotal entre las morosas de Ana
    expect(beto?.parcelaId).toBe("p3");
  });

  it("desempate por numero ascendente cuando hay igual deudaTotal", async () => {
    mockPeriodoGastoFindFirst.mockResolvedValue(null);
    mockParcelaFindMany.mockResolvedValue([
      parcela("p-b", "10", 60000, propietario("u1", "ana@x.cl", "Ana", "G", "ana")),
      parcela("p-a", "02", 60000, propietario("u1", "ana@x.cl", "Ana", "G", "ana")),
    ]);

    const result = await resolverDestinatarios("morosos");

    expect(result).toHaveLength(1);
    expect(result[0].parcelaId).toBe("p-a"); // misma deuda → numero menor ("02" < "10")
  });

  it("no genera destinatarios si no hay parcelas morosas", async () => {
    mockPeriodoGastoFindFirst.mockResolvedValue(null);
    mockParcelaFindMany.mockResolvedValue([]);

    const result = await resolverDestinatarios("morosos");

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});

describe("resolverDestinatarios - parcelas", () => {
  it("Escenario 5: solo los propietarios de las parcelas seleccionadas reciben el comunicado", async () => {
    mockParcelaFindMany.mockResolvedValue([
      parcela("p1", "01", 0, propietario("uA", "a@x.cl", "A", "X", "a")),
      parcela("p3", "03", 0, propietario("uC", "c@x.cl", "C", "X", "c")),
    ]);

    const result = await resolverDestinatarios("parcelas", ["p1", "p3"]);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.usuario.id).sort()).toEqual(["uA", "uC"]);
    expect(result.map((r) => r.parcelaId).sort()).toEqual(["p1", "p3"]);

    const args = mockParcelaFindMany.mock.calls[0]?.[0];
    expect(args.where.id).toEqual({ in: ["p1", "p3"] });
    expect(args.where.estado).toBe("ACTIVA");
    expect(args.where.propietarioId).toEqual({ not: null });
  });

  it("aplica dedupe y la regla de parcelaId (mayor deudaTotal) con 2 parcelas del mismo propietario", async () => {
    mockParcelaFindMany.mockResolvedValue([
      parcela("p1", "01", 40000, propietario("uA", "a@x.cl", "A", "X", "a")),
      parcela("p2", "02", 90000, propietario("uA", "a@x.cl", "A", "X", "a")),
    ]);

    const result = await resolverDestinatarios("parcelas", ["p1", "p2"]);

    expect(result).toHaveLength(1);
    expect(result[0].usuario.id).toBe("uA");
    expect(result[0].parcelaId).toBe("p2"); // mayor deudaTotal entre las seleccionadas
  });
});

describe("resolverDestinatarios - todos", () => {
  it("Escenario 1: una notificación por propietario activo con parcela activa, sin duplicados y parcelaId null", async () => {
    mockUsuarioFindMany.mockResolvedValue([
      propietario("u1", "a@x.cl", "Ana", "G", "ana"),
      propietario("u2", "b@x.cl", "Beto", "R", "beto"),
      propietario("u3", null, "Car", "M", "car"),
    ]);

    const result = await resolverDestinatarios("todos");

    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(r.parcelaId).toBeNull();
    }
    expect(new Set(result.map((r) => r.usuario.id)).size).toBe(3);

    const args = mockUsuarioFindMany.mock.calls[0]?.[0];
    expect(args.where.rol).toBe("PROPIETARIO");
    expect(args.where.isActive).toBe(true);
    expect(args.where.parcelas).toEqual({ some: { estado: "ACTIVA" } });
    // Requisito 7: NO filtrar por email — el usuario sin email debe llegar al envío (Notificacion ERROR)
    expect(args.where.email).toBeUndefined();
  });
});
