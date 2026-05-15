import { prisma } from "@/lib/prisma";
import { ConfiguracionSistema } from "@prisma/client";

export async function getConfig(): Promise<ConfiguracionSistema> {
  let config = await prisma.configuracionSistema.findUnique({ where: { id: 1 } });
  if (!config) {
    config = await prisma.configuracionSistema.create({ data: { id: 1 } });
  }
  return config;
}
