import { prisma } from "@/lib/prisma";
import { getConfig } from "./config";
import { toDecimal } from "@/lib/utils";

export function calcularMontoAguaTramos(
  sobreconsumo: number,
  tarifas: { t1_10: number; t11_20: number; t21_30: number; t31_40: number; t41mas: number }
): number {
  if (sobreconsumo <= 0) return 0;

  let tarifa: number;
  if (sobreconsumo <= 10)      tarifa = tarifas.t1_10;
  else if (sobreconsumo <= 20) tarifa = tarifas.t11_20;
  else if (sobreconsumo <= 30) tarifa = tarifas.t21_30;
  else if (sobreconsumo <= 40) tarifa = tarifas.t31_40;
  else                         tarifa = tarifas.t41mas;

  return sobreconsumo * tarifa;
}

export async function calcularConsumo(
  parcelaId: string,
  tipoConsumoId: string,
  periodo: Date,
  lecturaActual: number,
  lecturaAnteriorOverride?: number
) {
  const config = await getConfig();
  const tipoConsumo = await prisma.tipoConsumo.findUnique({ where: { id: tipoConsumoId } });
  if (!tipoConsumo) throw new Error("Tipo de consumo no encontrado");

  let lecturaAnterior = lecturaAnteriorOverride ?? 0;

  if (tipoConsumo.esVariable && lecturaAnteriorOverride === undefined) {
    const ultima = await prisma.consumoMensual.findFirst({
      where: { parcelaId, tipoConsumoId, periodo: { lt: periodo } },
      orderBy: { periodo: "desc" },
    });
    lecturaAnterior = ultima ? toDecimal(ultima.lecturaActual) : 0;
  }

  const consumoCalculado = Math.max(0, lecturaActual - lecturaAnterior);
  let montoConsumo = 0;
  let tarifaAplicada = 0;

  if (tipoConsumo.esVariable) {
    const nombreLower = tipoConsumo.nombre.toLowerCase();
    if (nombreLower === "agua") {
      const franquicia = toDecimal(config.franquiciaAguaM3);
      const sobreconsumo = Math.max(0, consumoCalculado - franquicia);
      montoConsumo = calcularMontoAguaTramos(sobreconsumo, {
        t1_10:   toDecimal(config.tarifaAgua1_10),
        t11_20:  toDecimal(config.tarifaAgua11_20),
        t21_30:  toDecimal(config.tarifaAgua21_30),
        t31_40:  toDecimal(config.tarifaAgua31_40),
        t41mas:  toDecimal(config.tarifaAgua41mas),
      });
      // tarifaAplicada referencial: tarifa del primer tramo activo
      tarifaAplicada = sobreconsumo > 0 ? toDecimal(config.tarifaAgua1_10) : 0;
    } else if (nombreLower === "luz") {
      tarifaAplicada = toDecimal(config.costoLuzKwh);
      montoConsumo = consumoCalculado * tarifaAplicada;
    }
  }

  return {
    lecturaAnterior,
    lecturaActual,
    consumoCalculado,
    tarifaAplicada,
    montoConsumo,
    cargoFijo: 0,
    totalAPagar: montoConsumo,
  };
}

export async function actualizarDeudasParcela(parcelaId: string) {
  const tipos = await prisma.tipoConsumo.findMany({ where: { activo: true } });

  const tipoAgua = tipos.find((t) => t.nombre.toLowerCase() === "agua");
  const tipoLuz = tipos.find((t) => t.nombre.toLowerCase() === "luz");
  const tipoGc = tipos.find((t) => t.nombre.toLowerCase() === "gasto común");

  const [deudaAgua, deudaLuz, deudaGc] = await Promise.all([
    tipoAgua
      ? prisma.consumoMensual.aggregate({
          where: { parcelaId, tipoConsumoId: tipoAgua.id, pagado: false },
          _sum: { totalAPagar: true },
        })
      : { _sum: { totalAPagar: null } },
    tipoLuz
      ? prisma.consumoMensual.aggregate({
          where: { parcelaId, tipoConsumoId: tipoLuz.id, pagado: false },
          _sum: { totalAPagar: true },
        })
      : { _sum: { totalAPagar: null } },
    tipoGc
      ? prisma.consumoMensual.aggregate({
          where: { parcelaId, tipoConsumoId: tipoGc.id, pagado: false },
          _sum: { totalAPagar: true },
        })
      : { _sum: { totalAPagar: null } },
  ]);

  const a = toDecimal(deudaAgua._sum.totalAPagar);
  const l = toDecimal(deudaLuz._sum.totalAPagar);
  const g = toDecimal(deudaGc._sum.totalAPagar);

  await prisma.parcela.update({
    where: { id: parcelaId },
    data: { deudaAgua: a, deudaLuz: l, deudaGc: g, deudaTotal: a + l + g },
  });
}
