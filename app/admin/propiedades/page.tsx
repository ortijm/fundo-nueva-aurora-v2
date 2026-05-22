import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PropiedadesClient } from "./propiedades-client";

export const metadata: Metadata = { title: "Inventario de Propiedades" };

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const params = await searchParams;

  const [parcelas, totalParcelas, usuarios] = await Promise.all([
    prisma.parcela.findMany({
      where: {
        ...(params.estado ? { estado: params.estado as "ACTIVA" | "INACTIVA" } : {}),
        ...(params.q
          ? {
              OR: [
                { numero: { contains: params.q } },
                { nombre: { contains: params.q } },
                { propietario: { firstName: { contains: params.q } } },
                { propietario: { lastName: { contains: params.q } } },
              ],
            }
          : {}),
      },
      include: { propietario: true },
      orderBy: { numero: "asc" },
    }),
    prisma.parcela.aggregate({
      where: { estado: "ACTIVA" },
      _count: { id: true },
      _sum: { deudaTotal: true },
    }),
    prisma.usuario.findMany({
      where: { rol: "PROPIETARIO" },
      include: { parcelas: { select: { id: true, numero: true, estado: true } } },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const parcelasActivas = totalParcelas._count.id;
  const parcelasPagadas = await prisma.parcela.count({
    where: { estado: "ACTIVA", deudaTotal: 0 },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display" style={{ color: "var(--on-surface)" }}>
          Inventario de Propiedades
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-muted)" }}>
          Gestiona el directorio de unidades y estados financieros.
        </p>
      </div>

      <PropiedadesClient
        parcelas={parcelas.map((p) => ({
          id: p.id,
          numero: p.numero,
          nombre: p.nombre,
          sector: p.sector,
          superficieM2: p.superficieM2 ? Number(p.superficieM2) : null,
          estado: p.estado,
          tipoGc: p.tipoGc,
          deudaTotal: Number(p.deudaTotal),
          deudaAgua: Number(p.deudaAgua),
          deudaLuz: Number(p.deudaLuz),
          deudaGc: Number(p.deudaGc),
          propietarioId: p.propietarioId,
          propietario: p.propietario
            ? {
                id: p.propietario.id,
                nombre: `${p.propietario.firstName} ${p.propietario.lastName}`.trim() || p.propietario.username,
                email: p.propietario.email || "",
                telefono: p.propietario.telefono,
              }
            : null,
        }))}
        usuarios={usuarios.map((u) => ({
          id: u.id,
          username: u.username,
          nombre: `${u.firstName} ${u.lastName}`.trim() || u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email || "",
          telefono: u.telefono,
          isActive: u.isActive,
          parcelas: u.parcelas.map((p) => ({ id: p.id, numero: p.numero, estado: p.estado })),
        }))}
        stats={{
          total: parcelasActivas,
          pagadas: parcelasPagadas,
          morosas: parcelasActivas - parcelasPagadas,
          deudaTotal: Number(totalParcelas._sum.deudaTotal || 0),
        }}
      />
    </div>
  );
}
