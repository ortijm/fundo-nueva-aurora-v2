import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockParcelaCreate = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    parcela: { create: mockParcelaCreate, update: vi.fn(), findUnique: vi.fn() },
    usuario: { findUnique: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { crearParcela } from "../../app/admin/propiedades/actions";

describe("crearParcela", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza si no hay sesión", async () => {
    mockAuth.mockResolvedValue(null);

    const form = new FormData();
    form.set("numero", "D-001");

    const result = await crearParcela(form);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No autorizado");
  });

  it("rechaza si no es ADMINISTRADOR", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", rol: "PROPIETARIO", name: "Test" },
    });

    const form = new FormData();
    form.set("numero", "D-001");

    const result = await crearParcela(form);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No autorizado");
  });

  it("rechaza si falta el número de parcela", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", rol: "ADMINISTRADOR", name: "Admin" },
    });

    const form = new FormData();

    const result = await crearParcela(form);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy(); // Zod valida que el campo es requerido
  });

  it("crea parcela correctamente", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", rol: "ADMINISTRADOR", name: "Admin" },
    });
    mockParcelaCreate.mockResolvedValue({ id: "nueva-id", numero: "D-001" });

    const form = new FormData();
    form.set("numero", "D-001");
    form.set("nombre", "Parcela Test");
    form.set("sector", "Sector D");

    const result = await crearParcela(form);
    expect(result.success).toBe(true);
    expect(mockParcelaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ numero: "D-001", nombre: "Parcela Test" }),
      }),
    );
  });
});
