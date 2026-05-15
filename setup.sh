#!/bin/bash
# ============================================================
# Setup inicial - Condominio Nueva Aurora (Next.js)
# ============================================================
set -e

echo "🏠 Configurando Condominio Nueva Aurora..."

# 1. Verificar Node.js >= 22
NODE_VER=$(node --version | cut -d. -f1 | tr -d v)
if [ "$NODE_VER" -lt 22 ]; then
  echo "⚠️  Se requiere Node.js >= 22. Usa: nvm use 22"
  exit 1
fi

# 2. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# 3. Variables de entorno
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Creado .env desde .env.example — edítalo con tus datos de MySQL."
fi

# 4. Generar cliente Prisma
echo "⚙️  Generando cliente Prisma..."
npx prisma generate

# 5. Crear tablas
echo "🗄️  Creando tablas en MySQL..."
npx prisma db push

# 6. Seed
echo "🌱 Cargando datos iniciales..."
npm run db:seed

echo ""
echo "✅ Setup completado. Inicia el servidor con: npm run dev"
echo ""
echo "📋 Credenciales:"
echo "   Admin:       admin / admin123"
echo "   Propietario: propietario / prop123"
echo ""
echo "🌐 Accede en: http://localhost:3000"
