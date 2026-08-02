import { prisma } from "@/lib/prisma";

export type OpcionDestinatarios = "todos" | "morosos" | "parcelas";

export interface DestinatarioResuelto {
  usuario: { id: string; email: string | null; firstName: string; lastName: string; username: string };
  parcelaId: string | null; // trazabilidad; null para "todos"
}

type ParcelaConPropietario = {
  id: string;
  numero: string;
  deudaTotal: unknown; // Decimal de Prisma o number plano en tests
  propietario: { id: string; email: string | null; firstName: string; lastName: string; username: string } | null;
};

/** Compara deudas numéricas (Prisma Decimal o number). */
function deudaEsMayor(a: unknown, b: unknown): boolean {
  return Number(a) > Number(b);
}

/**
 * Elige la parcela más representativa de la morosidad de un propietario:
 * mayor `deudaTotal`; desempate por `numero` ascendente (Decisión 3).
 */
function elegirParcelaRepresentativa(parcelas: ParcelaConPropietario[]): ParcelaConPropietario {
  return parcelas.reduce((mayor, p) => {
    if (deudaEsMayor(p.deudaTotal, mayor.deudaTotal)) return p;
    if (deudaEsMayor(mayor.deudaTotal, p.deudaTotal)) return mayor;
    return p.numero < mayor.numero ? p : mayor;
  });
}

/** Dedupe por propietario: un propietario = una notificación. */
function dedupePorPropietario(parcelas: ParcelaConPropietario[]): DestinatarioResuelto[] {
  const porPropietario = new Map<string, ParcelaConPropietario>();
  for (const p of parcelas) {
    if (!p.propietario) continue; // defensivo: sin propietario no hay destinatario
    const existente = porPropietario.get(p.propietario.id);
    porPropietario.set(p.propietario.id, existente ? elegirParcelaRepresentativa([existente, p]) : p);
  }
  return Array.from(porPropietario.values()).map((p) => ({
    usuario: p.propietario!, // garantizado no-null por la guardia del loop
    parcelaId: p.id,
  }));
}

async function resolverMorosos(): Promise<DestinatarioResuelto[]> {
  // Período actual = último PeriodoGasto; sin PeriodoGasto → solo condición deudaTotal
  const periodoActual = await prisma.periodoGasto.findFirst({
    orderBy: { periodo: "desc" },
    select: { periodo: true },
  });

  const parcelas = await prisma.parcela.findMany({
    where: {
      estado: "ACTIVA",
      propietarioId: { not: null },
      OR: [
        { deudaTotal: { gt: 0 } },
        ...(periodoActual
          ? [{ estadosCuenta: { some: { estado: "EMITIDO" as const, periodo: periodoActual.periodo } } }]
          : []),
      ],
    },
    select: {
      id: true,
      numero: true,
      deudaTotal: true,
      propietario: { select: { id: true, email: true, firstName: true, lastName: true, username: true } },
    },
  });

  return dedupePorPropietario(parcelas);
}

async function resolverTodos(): Promise<DestinatarioResuelto[]> {
  // Sin filtro email: { not: null } — un usuario sin email llega al envío (Requisito 7)
  const usuarios = await prisma.usuario.findMany({
    where: {
      rol: "PROPIETARIO",
      isActive: true,
      parcelas: { some: { estado: "ACTIVA" } },
    },
    select: { id: true, email: true, firstName: true, lastName: true, username: true },
  });
  return usuarios.map((u) => ({ usuario: u, parcelaId: null }));
}

async function resolverParcelas(parcelaIds: string[]): Promise<DestinatarioResuelto[]> {
  const parcelas = await prisma.parcela.findMany({
    where: { id: { in: parcelaIds }, estado: "ACTIVA", propietarioId: { not: null } },
    select: {
      id: true,
      numero: true,
      deudaTotal: true,
      propietario: { select: { id: true, email: true, firstName: true, lastName: true, username: true } },
    },
  });
  return dedupePorPropietario(parcelas);
}

/**
 * Resuelve los destinatarios de un comunicado (Requisito 5: query única y testeable).
 * Cada opción usa una cantidad constante de queries, sin bucles por parcela.
 */
export async function resolverDestinatarios(
  opcion: OpcionDestinatarios,
  parcelaIdsSeleccionadas?: string[]
): Promise<DestinatarioResuelto[]> {
  if (opcion === "morosos") return resolverMorosos();
  if (opcion === "parcelas") return resolverParcelas(parcelaIdsSeleccionadas ?? []);
  return resolverTodos();
}
