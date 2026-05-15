import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toDecimal } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parcelaId = searchParams.get("parcelaId");

  if (!parcelaId) {
    return NextResponse.json({ error: "parcelaId es requerido" }, { status: 400 });
  }

  const consumos = await prisma.consumoMensual.findMany({
    where: {
      parcelaId,
      estado: { in: ["CON_ESTADO_CUENTA"] },
      totalAPagar: { gt: 0 },
    },
    include: { tipoConsumo: true },
    orderBy: { periodo: "desc" },
  });

  return NextResponse.json({
    consumos: consumos.map((c) => ({
      id: c.id,
      tipo: c.tipoConsumo.nombre,
      periodo: c.periodo.toISOString(),
      totalAPagar: toDecimal(c.totalAPagar),
    })),
  });
}