import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function createAuthUser(email: string, password: string, metadata: Record<string, string>) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) {
    // Si el usuario ya existe en Auth, buscarlo
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users.find((u) => u.email === email);
    if (found) return found;
    throw error;
  }
  return data.user;
}

async function main() {
  console.log("🌱 Iniciando seed de base de datos...");

  // Configuración del sistema
  await prisma.configuracionSistema.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nombreCondominio: "Condominio Nueva Aurora",
      banco: "BancoEstado",
      tipoCuenta: "Cuenta Corriente",
      numeroCuenta: "00-123-45678-01",
      emailPagos: "pagos@nuevaaurora.cl",
      franquiciaAguaM3: 30,
      tarifaAgua1_10: 2000,
      tarifaAgua11_20: 2500,
      tarifaAgua21_30: 3500,
      tarifaAgua31_40: 4000,
      tarifaAgua41mas: 5000,
      costoLuzKwh: 291,
      montoGcNuevo: 15000,
      montoGcConHistorial: 25000,
    },
    update: {},
  });

  // Tipos de consumo
  const tiposData = [
    { nombre: "Agua", descripcion: "Consumo de agua potable", unidadMedida: "m³", esVariable: true, color: "#17335a", icono: "droplet", orden: 1 },
    { nombre: "Luz", descripcion: "Consumo de electricidad", unidadMedida: "kWh", esVariable: true, color: "#f59e0b", icono: "bolt", orden: 2 },
    { nombre: "Gasto Común", descripcion: "Gasto común mensual", unidadMedida: "$", esVariable: false, color: "#455a75", icono: "receipt", orden: 3 },
  ];

  for (const tipo of tiposData) {
    await prisma.tipoConsumo.upsert({
      where: { nombre: tipo.nombre },
      create: tipo,
      update: {},
    });
  }

  // Usuario administrador — crear en Supabase Auth y en BD
  console.log("  Creando usuario admin en Supabase Auth...");
  const adminAuth = await createAuthUser("admin@nuevaaurora.cl", "admin123", { rol: "ADMINISTRADOR", username: "admin" });

  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    create: {
      supabaseId: adminAuth.id,
      username: "admin",
      email: "admin@nuevaaurora.cl",
      firstName: "Administrador",
      lastName: "Sistema",
      rol: "ADMINISTRADOR",
      cargo: "Administrador del Condominio",
      isActive: true,
    },
    update: { supabaseId: adminAuth.id },
  });

  // Usuario propietario de ejemplo
  console.log("  Creando usuario propietario en Supabase Auth...");
  const propAuth = await createAuthUser("propietario@ejemplo.cl", "prop123", { rol: "PROPIETARIO", username: "propietario" });

  const propietario = await prisma.usuario.upsert({
    where: { username: "propietario" },
    create: {
      supabaseId: propAuth.id,
      username: "propietario",
      email: "propietario@ejemplo.cl",
      firstName: "Juan",
      lastName: "Pérez",
      rol: "PROPIETARIO",
      telefono: "+56912345678",
      isActive: true,
    },
    update: { supabaseId: propAuth.id },
  });

  // Parcela de ejemplo
  await prisma.parcela.upsert({
    where: { numero: "A-101" },
    create: {
      numero: "A-101",
      nombre: "Parcela Oriente",
      sector: "Sector A",
      superficieM2: 5000,
      propietarioId: propietario.id,
      numeroMedidorAgua: "MED-001",
      numeroMedidorLuz: "LUZ-001",
    },
    update: {},
  });

  await prisma.parcela.upsert({
    where: { numero: "B-205" },
    create: {
      numero: "B-205",
      nombre: "Parcela Norte",
      sector: "Sector B",
      superficieM2: 6200,
    },
    update: {},
  });

  await prisma.parcela.upsert({
    where: { numero: "C-310" },
    create: {
      numero: "C-310",
      nombre: "Parcela Poniente",
      sector: "Sector C",
      superficieM2: 4800,
    },
    update: {},
  });

  console.log("✅ Seed completado exitosamente.");
  console.log("\n📋 Credenciales (login con EMAIL):");
  console.log("   Administrador: admin@nuevaaurora.cl / admin123");
  console.log("   Propietario:   propietario@ejemplo.cl / prop123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
