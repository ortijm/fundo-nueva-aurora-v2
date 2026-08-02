/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDeleteMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimit: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      deleteMany: mockDeleteMany,
    },
  },
}));

import { checkRateLimit, resetRateLimit } from "../../lib/ratelimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite el primer intento", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "1",
      identifier: "ip-test",
      action: "login",
      attempts: 1,
      windowStart: new Date(),
    });

    const result = await checkRateLimit("ip-test", "login");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("bloquea después de 5 intentos en la ventana", async () => {
    mockFindUnique.mockResolvedValue({
      id: "1",
      identifier: "ip-test",
      action: "login",
      attempts: 5,
      windowStart: new Date(),
    });
    mockUpdate.mockResolvedValue({} as any);

    const result = await checkRateLimit("ip-test", "login");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("reinicia la ventana si expiró", async () => {
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      id: "1",
      identifier: "ip-test",
      action: "login",
      attempts: 5,
      windowStart: haceUnaHora,
    });
    mockUpdate.mockResolvedValue({} as any);

    const result = await checkRateLimit("ip-test", "login");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("Requisito 4: agotar enviar-comunicado NO bloquea forgot-password (aislamiento por identifier + action)", async () => {
    // La clave @@unique([identifier, action]) separa los contadores por acción
    mockFindUnique.mockImplementation(({ where }: any) => {
      const { identifier, action } = where.identifier_action;
      if (identifier === "enviar-comunicado:user-1" && action === "enviar-comunicado") {
        return Promise.resolve({
          id: "rl-comunicado",
          identifier,
          action,
          attempts: 5,
          windowStart: new Date(),
        });
      }
      return Promise.resolve(null);
    });
    mockUpdate.mockResolvedValue({} as any);
    mockCreate.mockResolvedValue({
      id: "rl-forgot",
      identifier: "forgot-password:ip-1",
      action: "forgot-password",
      attempts: 1,
      windowStart: new Date(),
    });

    // Comunicado agotado: 5 intentos dentro de la ventana
    const comunicado = await checkRateLimit("enviar-comunicado:user-1", "enviar-comunicado");
    expect(comunicado.allowed).toBe(false);

    // Forgot-password con clave distinta: sin registro previo → primer intento permitido
    const forgot = await checkRateLimit("forgot-password:ip-1", "forgot-password");
    expect(forgot.allowed).toBe(true);
    expect(forgot.remaining).toBe(4);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        identifier: "forgot-password:ip-1",
        action: "forgot-password",
        attempts: 1,
        windowStart: expect.any(Date),
      },
    });
  });
});

describe("resetRateLimit", () => {
  it("elimina registros para identifier + action", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });

    await resetRateLimit("ip-test", "login");

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { identifier: "ip-test", action: "login" },
    });
  });
});
