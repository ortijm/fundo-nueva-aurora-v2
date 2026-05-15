import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

export async function checkRateLimit(
  identifier: string,
  action: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  const record = await prisma.rateLimit.findUnique({
    where: { identifier_action: { identifier, action } },
  });

  if (!record) {
    // Primer intento: crear registro
    await prisma.rateLimit.create({
      data: { identifier, action, attempts: 1, windowStart: now },
    });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetIn: WINDOW_MS };
  }

  // Si la ventana expiró, reiniciar
  if (record.windowStart < windowStart) {
    await prisma.rateLimit.update({
      where: { id: record.id },
      data: { attempts: 1, windowStart: now },
    });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetIn: WINDOW_MS };
  }

  // Dentro de la ventana: incrementar
  const newAttempts = record.attempts + 1;
  const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);
  const elapsed = now.getTime() - record.windowStart.getTime();
  const resetIn = Math.max(0, WINDOW_MS - elapsed);

  await prisma.rateLimit.update({
    where: { id: record.id },
    data: { attempts: newAttempts },
  });

  return {
    allowed: newAttempts <= MAX_ATTEMPTS,
    remaining,
    resetIn,
  };
}

export async function resetRateLimit(identifier: string, action: string) {
  await prisma.rateLimit.deleteMany({
    where: { identifier, action },
  });
}
