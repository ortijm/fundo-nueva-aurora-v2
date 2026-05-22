# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Next.js 16.2.1 + TypeScript condominium management system for "Condominio Nueva Aurora". Spanish-speaking user base. Migrated from a Django/MySQL system.

**Roles:** ADMINISTRADOR, PROPIETARIO  
**Modules:** Dashboard, Consumos (agua/luz/GC), Gastos, Validación de Pagos, Propiedades, Estados de Cuenta, Configuración

## Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 5 |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (bucket: `comprobantes`) |
| UI | Tailwind CSS v4, shadcn/ui (Radix primitives), Lucide icons |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| PDF | @react-pdf/renderer (billing PDFs) |
| Email | SMTP via Brevo (Nodemailer) |
| Testing | Vitest v4 (strict TDD mode) |
| Linting | ESLint 9 (eslint-config-next) |
| Excel | xlsx (meter reading imports) |

## Setup & Commands

```bash
# Requires Node.js >= 22 (nvm use 22)
./setup.sh               # One-command setup

npm run dev              # Development server at http://localhost:3000
npm run build            # Production build (generates Prisma client + pushes schema)
npm run dev -- --turbo   # Turbopack for faster dev iteration
npm run lint             # ESLint
npm run test             # Vitest (run once)
npm run test:watch       # Vitest (watch mode)
npm run test:coverage    # Vitest with coverage report
npm run db:push          # Sync Prisma schema to DB (safe for dev)
npm run db:migrate       # Create a new Prisma migration
npm run db:seed          # Seed initial data (admin / admin123 | propietario / prop123)
npm run db:studio        # Prisma Studio GUI
```

## Architecture

```
app/
├── admin/              # ADMINISTRADOR role routes
│   ├── dashboard/      # KPIs, charts, pending payments
│   ├── consumos/       # Meter readings + Excel import
│   ├── gastos/         # Expenses + Gastos Comunes generation
│   ├── validacion/     # Payment voucher approval
│   ├── propiedades/    # Property + owner management
│   └── configuracion/  # Rates, bank data
├── propietario/        # PROPIETARIO role routes
│   ├── dashboard/      # Debt, charts, history
│   ├── informar-pago/  # Submit payment voucher
│   └── estados-cuenta/ # Billing history + PDF download
├── login/              # Auth (Supabase email/password)
├── forgot-password/    # Password recovery
├── reset-password/     # Password reset (via magic link)
└── api/
    ├── auth/           # Supabase Auth server helpers (forgot/reset)
    ├── comprobantes/   # Serve payment voucher images from Supabase Storage
    ├── consumos-pendientes/ # Quick API for billing data
    └── ec/             # Estado de Cuenta PDF generation

lib/
├── auth.ts             # Supabase session helper (replaces old NextAuth)
├── prisma.ts           # Prisma singleton
├── utils.ts            # formatCLP, formatDate, toDecimal
├── ratelimit.ts        # Rate limiting (in-memory sliding window)
├── server-action-utils.ts # withErrorHandling(), unauthorized() helpers
└── supabase/
│   ├── server.ts       # Supabase server client (App Router / Server Components)
│   ├── client.ts       # Supabase browser client (Client Components)
│   ├── middleware.ts    # Supabase session refresh (edge middleware helper)
│   ├── admin.ts        # Supabase admin client (service_role key — server-only)
│   └── storage.ts      # uploadComprobante() helper
└── services/
    ├── config.ts       # getConfig() singleton
    ├── consumos.ts     # calcularConsumo(), actualizarDeudasParcela()
    └── email.ts        # Nodemailer via Brevo SMTP

tests/
├── services/
│   ├── ratelimit.test.ts
│   └── consumos.test.ts
├── actions/
│   └── validacion.test.ts
└── utils.test.ts
```

## Key Patterns

**Server Actions** for all mutations (wrapped with `withErrorHandling`):
```typescript
"use server";
import { auth, getCurrentUser } from "@/lib/auth";
import { withErrorHandling, unauthorized } from "@/lib/server-action-utils";
import { revalidatePath } from "next/cache";

export async function myAction(formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    if (!user || user.rol !== "ADMINISTRADOR") throw unauthorized();

    // ... business logic

    revalidatePath("/admin/something");
    return { success: true };
  }, "myAction");
}
```

**Auth check** (always server-side):
```typescript
import { auth, getCurrentUser } from "@/lib/auth";

// Full session:
const session = await auth();

// Just user + rol (for Server Actions):
const user = await getCurrentUser();
if (!user) return { error: "No autorizado" };
```

**Supabase Admin client** (for storage uploads, user management):
```typescript
import { createAdminClient } from "@/lib/supabase/admin";
const supabase = createAdminClient();
```

**Money handling**: Always convert `Decimal` to `Number` before passing to Client Components: use `toDecimal()` or `Number()`.

**Rate limiting** for sensitive actions:
```typescript
import { checkRateLimit } from "@/lib/ratelimit";
const { ok, retryAfter } = checkRateLimit(userId);
if (!ok) return { error: `Demasiadas solicitudes. Espere ${retryAfter}s.` };
```

## Business Logic

- **Agua:** 30m³ franchise (configurable via `getConfig()`). Excess charged at `costoAguaM3Adicional`/m³.
- **Luz:** Per-kWh at `costoLuzKwh`.
- **Gasto Común:** `montoGcNuevo` for new owners, `montoGcConHistorial` for established ones.
- **Payments:** PENDIENTE → APROBADO | RECHAZADO. Approval marks consumos PAGADO + registers FondoCondominio entry.
- **Debt cache:** `actualizarDeudasParcela()` recalculates `deudaAgua/Luz/Gc/Total` on Parcela.
- **Config:** Always use `getConfig()` — auto-creates singleton with defaults.

## Design System

"Architectural Steward" (see `../Imagenes_proyecto/DESIGN.md`):
- No 1px borders — use surface color shifts (`--surface`, `--surface-low`, `--surface-card`)
- Fonts: Manrope (`.font-display`) + Inter (body)
- Primary: `#17335a`, Success: `#003b22`, Error: `#ba1a1a`
- CSS vars in `app/globals.css` — use as `style={{ color: "var(--on-surface)" }}`
- Chips: `.chip-confirmed`, `.chip-pending`, `.chip-error`, `.chip-warning`
- Tables: `data-table` class → alternating bg rows, no dividers

## Environment Variables

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.REFERENCIA:password@pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.REFERENCIA:password@pooler.supabase.com:5432/postgres"

# Supabase Auth + Storage
NEXT_PUBLIC_SUPABASE_URL="https://REFERENCIA.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="anon_key_de_supabase_settings_api"
SUPABASE_SERVICE_ROLE_KEY="service_role_key_de_supabase_settings_api"

# SMTP (Brevo)
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="tu_smtp_login@smtp-brevo.com"
SMTP_PASS="tu_smtp_key"
EMAIL_FROM="Nueva Aurora <noreply@dominio.cl>"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```
