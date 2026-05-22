# Design: Gasto Común configurable por parcela

## Technical Approach

Agregar un campo `tipoGc` (NORMAL / REDUCIDO) al modelo Parcela. La generación de GC lee este campo directamente en vez de inferir el monto desde el historial de consumo. El administrador controla el valor desde el formulario de propiedades.

## Architecture Decisions

### Decision: Campo directo en Parcela vs tabla separada

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Campo `tipoGc` en Parcela | Simple, 1:1 con la parcela, sin joins | ✅ Elegido |
| Tabla `ConfigGcParcela` | Más flexible para futuros campos, pero overkill | ❌ Rechazado |

### Decision: Enum vs Boolean

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Enum `TipoGastoComun { NORMAL, REDUCIDO }` | Escalable a más tipos en el futuro | ✅ Elegido |
| Boolean `gcReducido` | Simple pero no escala | ❌ Rechazado |

### Decision: Reemplazar historial vs combinarlo

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| Solo usar `tipoGc` | Control total del admin, simple | ✅ Elegido |
| Combinar: si REDUCIDO usarlo, si NORMAL fallback a historial | Confuso, dos fuentes de verdad | ❌ Rechazado |

## Data Flow

```
Admin (UI Propiedades)
  ──setea tipoGc──→ Parcela.tipoGc

Admin (UI Gastos)
  ──"Generar Gastos"──→ generarGastosComunes()
                           │
                           ▼
                    Prisma: findMany parcelas activas
                           │
                           ▼
                    Por cada parcela:
                      tipoGc = NORMAL  →  config.montoGcConHistorial
                      tipoGc = REDUCIDO → config.montoGcNuevo
                           │
                           ▼
                    Prisma: upsert ConsumoMensual (tipo GC)
                           │
                           ▼
                    actualizarDeudasParcela()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | + enum `TipoGastoComun`, + campo `tipoGc` en Parcela |
| `app/admin/consumos/actions.ts` | Modify | `generarGastosComunes` usa `parcela.tipoGc` |
| `app/admin/propiedades/actions.ts` | Modify | + `tipoGc` en schemas y handlers |
| `app/admin/propiedades/page.tsx` | Modify | Pasar `tipoGc` al client |
| `app/admin/propiedades/propiedades-client.tsx` | Modify | + Select en modal + columna en tabla |
| `scripts/migrar-tipo-gc.ts` | Create | Script one-time de migración |
| `tests/services/gasto-comun-por-parcela.test.ts` | Create | Tests unitarios |

## Interfaces / Contracts

```prisma
enum TipoGastoComun {
  NORMAL
  REDUCIDO
}

model Parcela {
  // ... existing fields
  tipoGc TipoGastoComun @default(NORMAL)
}
```

```typescript
// Nueva lógica en generarGastosComunes
const monto = parcela.tipoGc === "REDUCIDO"
  ? Number(config.montoGcNuevo)       // $15.000
  : Number(config.montoGcConHistorial); // $25.000
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `generarGastosComunes` logic | Función helper pura: `calcularMontoGc(tipoGc, config)` retorna monto |
| Unit | Admin form validation | Zod schema acepta/rechaza `tipoGc` |
| Unit | Migration script | Verifica asignación correcta según historial |

Tests existentes no se modifican (43 tests, deben seguir pasando).

## Migration / Rollout

1. Agregar campo `tipoGc` a schema → `npx prisma db push`
2. Ejecutar script `scripts/migrar-tipo-gc.ts` que asigna REDUCIDO a parcelas sin historial
3. Deploy a Vercel

Rollback: remover campo + `prisma db push`. GC generados antes del cambio quedan intactos.

## Open Questions

- None
