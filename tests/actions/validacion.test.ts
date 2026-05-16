/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

// Mock de prisma genérico que maneja acceso a propiedades
const prismaProxy = vi.hoisted(() => new Proxy({} as any, {
  get(_target, prop: string) {
    // Retorna un proxy para cualquier modelo
    return new Proxy({} as any, {
      get(_t, method: string) {
        if (prop === "pago" && method === "findUnique") return mockFindUnique;
        if (prop === "pago" && method === "update") return vi.fn().mockResolvedValue({});
        if (method === "create") return vi.fn().mockResolvedValue({});
        if (method === "update") return vi.fn().mockResolvedValue({});
        if (method === "updateMany") return vi.fn().mockResolvedValue({ count: 1 });
        if (method === "findMany") return vi.fn().mockResolvedValue([]);
        return vi.fn().mockResolvedValue({});
      },
    });
  },
}));

// Mock $transaction para ejecutar la función interna
prismaProxy.$transaction = vi.fn().mockImplementation((fn: any) => fn(prismaProxy));

vi.mock("@/lib/prisma", () => ({ prisma: prismaProxy }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { aprobarPago, rechazarPago } from "../../app/admin/validacion/actions";

describe("validacion actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("aprobarPago", () => {
    it("rechaza si no hay sesión", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await aprobarPago("pago-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No autorizado");
    });

    it("rechaza si no es ADMINISTRADOR", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "1", rol: "PROPIETARIO", name: "Test" },
      });
      const result = await aprobarPago("pago-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No autorizado");
    });
  });

  describe("rechazarPago", () => {
    it("rechaza si no hay sesión", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await rechazarPago("pago-1", "motivo");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No autorizado");
    });

    it("rechaza si no es ADMINISTRADOR", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "1", rol: "PROPIETARIO", name: "Test" },
      });
      const result = await rechazarPago("pago-1", "motivo");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No autorizado");
    });
  });
});
