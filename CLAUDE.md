# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js 15 + TypeScript condominium management system for "Condominio Nueva Aurora". Full-stack monorepo replacing a Django/MySQL system. Spanish-speaking user base.

**Roles:** ADMINISTRADOR, PROPIETARIO  
**Modules:** Dashboard, Consumos (agua/luz/GC), Gastos, Validación de Pagos, Propiedades, Estados de Cuenta, Configuración

## Setup & Commands

```bash
# Requires Node.js >= 22 (nvm use 22)
./setup.sh               # One-command setup

npm run dev              # Development server at http://localhost:3000
npm run build            # Production build
npm run db:push          # Sync schema to DB
npm run db:seed          # Seed initial data
npm run db:studio        # Prisma Studio GUI
npx prisma generate      # Regenerate client after schema changes
```

Default credentials (after seed): admin / admin123 | propietario / prop123

## Architecture

```
app/
├── admin/           # ADMINISTRADOR role routes
│   ├── dashboard/   # KPIs, charts, pending payments
│   ├── consumos/    # Meter readings + Excel import
│   ├── gastos/      # Expenses + Gastos Comunes generation
│   ├── validacion/  # Payment voucher approval
│   ├── propiedades/ # Property + owner management
│   └── configuracion/ # Rates, bank data
├── propietario/     # PROPIETARIO role routes
│   ├── dashboard/   # Debt, charts, history
│   ├── informar-pago/ # Submit payment voucher
│   └── estados-cuenta/ # Billing history + PDF download
├── login/           # Auth
└── api/auth/        # NextAuth v5

lib/
├── auth.ts          # NextAuth (Credentials + bcrypt + JWT)
├── prisma.ts        # Prisma singleton
├── utils.ts         # formatCLP, formatDate, toDecimal
└── services/
    ├── config.ts    # getConfig() singleton
    ├── consumos.ts  # calcularConsumo(), actualizarDeudasParcela()
    └── email.ts     # Resend notifications
```

## Key Patterns

**Server Actions** for all mutations:
```typescript
"use server";
export async function myAction(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") return { error: "No autorizado" };
  // ...
  revalidatePath("/admin/something");
  return { success: true };
}
```

Always convert `Decimal` to `Number` before passing to Client Components: use `toDecimal()` or `Number()`.

## Business Logic

- **Agua:** 30m³ franchise (configurable). Excess charged at `costoAguaM3Adicional`/m³.
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

```
DATABASE_URL="mysql://user:pass@localhost:3306/nueva_aurora_db"
AUTH_SECRET="random-32-chars"
RESEND_API_KEY="re_..."   # Optional
EMAIL_FROM="Nueva Aurora <noreply@domain.cl>"
```
