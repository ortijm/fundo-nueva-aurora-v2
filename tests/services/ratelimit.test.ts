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
