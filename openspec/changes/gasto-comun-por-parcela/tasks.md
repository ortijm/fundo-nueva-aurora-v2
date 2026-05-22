# Tasks: Gasto Común configurable por parcela

## Task 1: Schema — agregar tipoGc a Parcela

**Files**: `prisma/schema.prisma`

- Agregar enum `TipoGastoComun { NORMAL REDUCIDO }`
- Agregar campo `tipoGc TipoGastoComun @default(NORMAL)` al modelo Parcela
- Ejecutar `npx prisma db push`

**Acceptance**: `prisma db push` exitoso, tipoGc visible en DB

---

## Task 2: Server Action — generarGastosComunes usa tipoGc

**Files**: `app/admin/consumos/actions.ts`

- Reemplazar bloque de decisión de monto (líneas 107-114):
  ```typescript
  // ANTES
  const tieneHistorial = await prisma.consumoMensual.count({
    where: { parcelaId: parcela.id, tipoConsumoId: { not: tipoGc.id } },
  });
  const monto = tieneHistorial > 0
    ? Number(config.montoGcConHistorial)
    : Number(config.montoGcNuevo);

  // DESPUÉS
  const monto = parcela.tipoGc === "REDUCIDO"
    ? Number(config.montoGcNuevo)
    : Number(config.montoGcConHistorial);
  ```
- No es necesario modificar la query `findMany` (ya incluye parcela completa)

**Acceptance**: Generar GC asigna montos según `tipoGc` de cada parcela

---

## Task 3: Server Actions — agregar tipoGc a crear/editar parcela

**Files**: `app/admin/propiedades/actions.ts`

- Agregar `tipoGc` a `crearParcelaSchema` (opcional, default "NORMAL")
- Agregar `tipoGc` a `editarParcelaSchema` (opcional, default "NORMAL")
- Pasar `tipoGc` en `crearParcela()` `prisma.parcela.create({ data: {...parsed.data, tipoGc: parsed.data.tipoGc }})`
- Pasar `tipoGc` en `editarParcela()` `prisma.parcela.update({ data: { ...parsed.data, tipoGc: parsed.data.tipoGc }})`

**Acceptance**: Zod acepta "NORMAL" | "REDUCIDO", create/update persisten el campo

---

## Task 4: Admin Page — pasar tipoGc al client

**Files**: `app/admin/propiedades/page.tsx`

- Agregar `tipoGc: p.tipoGc` en el `map` de `parcelas` al `PropiedadesClient`

**Acceptance**: Client recibe tipoGc en el objeto parcela

---

## Task 5: Admin UI — select tipoGc en formulario + columna en tabla

**Files**: `app/admin/propiedades/propiedades-client.tsx`

- Agregar campo `tipoGc: string` a la interface `ParcelaItem`
- En el modal de parcela, después del campo "Propietario", agregar:
  ```tsx
  <div>
    <label className="block text-xs font-semibold mb-1.5">Gasto Común</label>
    <select name="tipoGc" defaultValue={editandoParcela?.tipoGc || "NORMAL"} className="...">
      <option value="NORMAL">Normal ($25.000)</option>
      <option value="REDUCIDO">Reducido ($15.000)</option>
    </select>
  </div>
  ```
- En la tabla, agregar columna "GC" entre "Contacto" y "Estado":
  ```tsx
  <th className="...">GC</th>
  // ...
  <td className="py-3 px-4 text-center">
    <span className={p.tipoGc === "REDUCIDO" ? "chip-warning" : "..."}>
      {p.tipoGc === "REDUCIDO" ? "$15.000" : "$25.000"}
    </span>
  </td>
  ```

**Acceptance**: Select visible en formulario, columna visible en tabla

---

## Task 6: Script — migración one-time de parcelas existentes

**Files**: `scripts/migrar-tipo-gc.ts`

```typescript
// scripts/migrar-tipo-gc.ts
import { prisma } from "../lib/prisma";

async function main() {
  const tipoGc = await prisma.tipoConsumo.findFirst({
    where: { nombre: { contains: "Gasto" } },
  });

  const parcelas = await prisma.parcela.findMany({ where: { estado: "ACTIVA" } });

  for (const parcela of parcelas) {
    const tieneHistorial = await prisma.consumoMensual.count({
      where: { parcelaId: parcela.id, tipoConsumoId: tipoGc ? { not: tipoGc.id } : undefined },
    });

    await prisma.parcela.update({
      where: { id: parcela.id },
      data: { tipoGc: tieneHistorial > 0 ? "NORMAL" : "REDUCIDO" },
    });
  }

  console.log(`Migradas ${parcelas.length} parcelas`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

**Acceptance**: Script ejecutable con `npx tsx scripts/migrar-tipo-gc.ts`

---

## Task 7: Tests — lógica de tipoGc

**Files**: `tests/services/gasto-comun-por-parcela.test.ts`

- `calcularMontoGc(tipoGc, montoNuevo, montoConHistorial)` función helper
- Tests:
  - `tipoGc = NORMAL` → retorna `montoConHistorial`
  - `tipoGc = REDUCIDO` → retorna `montoNuevo`
  - `tipoGc = undefined/null` → default a `montoConHistorial` (backward compat)

**Acceptance**: tests pasan, no rompen tests existentes

---

## Review Workload

| Task | Files | Líneas estimadas | Riesgo |
|------|-------|-------------------|--------|
| 1. Schema | 1 | +3 | Bajo |
| 2. Server Action | 1 | -3, +2 | Bajo |
| 3. Server Actions props | 1 | +12 | Bajo |
| 4. Admin Page | 1 | +1 | Muy bajo |
| 5. Admin UI | 1 | +20 | Medio |
| 6. Migration script | 1 | +25 | Bajo |
| 7. Tests | 1 | +30 | Bajo |
| **Total** | **7** | **~90 líneas** | **Bajo** |

No requiere chained PRs (< 400 líneas, riesgo bajo).
