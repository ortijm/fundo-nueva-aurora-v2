type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

function isActionError(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Error inesperado del servidor";
}

/**
 * Wraps a Server Action with consistent error handling.
 * Logs the error context and returns a typed ActionResult.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const message = isActionError(error);
    console.error(`[ServerAction${context ? `:${context}` : ""}]`, message);
    return { success: false, error: message ?? "Error inesperado" };
  }
}

/**
 * Returns a standard unauthorized response.
 */
export function unauthorized(): ActionResult {
  return { success: false, error: "No autorizado" };
}

/**
 * Returns a standard validation error response.
 */
export function validationError(message: string): ActionResult {
  return { success: false, error: message };
}

/**
 * Extract typed data from an ActionResult in client components.
 * Usage: const { ok, errores } = getResultData<{ ok: number; errores: string[] }>(res);
 */
export function getResultData<T>(res: ActionResult): T | undefined {
  return res.data as T | undefined;
}
