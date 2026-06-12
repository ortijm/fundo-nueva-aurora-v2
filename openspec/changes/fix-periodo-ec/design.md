# Design: Fix EC Billing Period Display

## Decisión de arquitectura

Se implementa un **helper centralizado** `getPeriodoBilling` en `lib/utils.ts` que encapsula la lógica de desplazamiento -1 mes. Todos los puntos de renderizado importan y usan esta función, eliminando duplicación y garantizando consistencia.

**Por qué helper vs. inline:** El desplazamiento se necesita en 7+ ubicaciones. Un helper centralizado garantiza un solo punto de mantenimiento, facilita tests unitarios, y evita inconsistencias si la lógica cambia (ej: considerar zona horaria).

---

## Helper: `getPeriodoBilling`

**Ubicación:** `lib/utils.ts`

**Firma:**
```ts
export function getPeriodoBilling(periodo: Date): Date
```

**Implementación:**
```ts
export function getPeriodoBilling(periodo: Date): Date {
  const d = new Date(periodo);
  d.setMonth(d.getMonth() - 1);
  return d;
}
```

`Date.setMonth` con valor negativo (ej: mes 0 - 1 = -1) ajusta automáticamente: año -1, mes 12. No se necesita lógica explícita para enero → diciembre.

**Export:** Se agrega al archivo `lib/utils.ts` existente, junto a `formatPeriodo` y `formatPeriodoCorto`.

---

## Cambios por archivo

### 1. `lib/utils.ts` — Agregar helper

- **Acción:** Agregar función `getPeriodoBilling`
- **Línea:** Después de `getPrimerDiaMes` (línea 48)
- **Import:** Ninguno (usa solo `Date` nativo)

### 2. `app/api/ec/[id]/pdf/route.ts` — PeriodoLabel del encabezado

- **Función:** `GET` (ruta del PDF)
- **Línea 48-49:** Cambiar de:
  ```ts
  const dt = new Date(ec.periodo);
  const periodoLabel = `${meses[dt.getMonth()]} ${dt.getFullYear()}`;
  ```
  A:
  ```ts
  const dt = getPeriodoBilling(new Date(ec.periodo));
  const periodoLabel = `${meses[dt.getMonth()]} ${dt.getFullYear()}`;
  ```
- **Línea 91:** El filename también debe usar el período de facturación:
  ```ts
  const filename = `EstadoCuenta_${ec.parcela.numero}_${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}.pdf`;
  ```
  (`dt` ya está desplazado por el cambio anterior, así que esto se corrige automáticamente)
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils`

### 3. `lib/pdf/estado-cuenta-pdf.tsx` — Filas de detalle (fmtPeriodoCorto)

- **Función:** `fmtPeriodoCorto` (línea 59-63)
- **Acción:** Cambiar la función para que desplace el período antes de formatear:
  ```ts
  function fmtPeriodoCorto(d: Date): string {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const dt = new Date(d);
    dt.setMonth(dt.getMonth() - 1);
    return `${meses[dt.getMonth()]} ${dt.getFullYear()}`;
  }
  ```
- **Líneas 395, 403:** No cambian — ya llaman `fmtPeriodoCorto(item.periodo)`, y ahora la función internamente desplaza.
- **Nota:** Esta función es interna del componente PDF (no está exportada). Se duplica la lógica de -1 mes aquí porque `@react-pdf/renderer` corre en un contexto aislado y no puede importar de `lib/utils.ts` de forma confiable. Si en el futuro se extrae a un shared module, se unifica.

### 4. `lib/services/email.ts` — Período en email

- **Función:** `enviarNotificacionEstadoCuenta` (línea 42-107)
- **Línea 54:** Cambiar de:
  ```ts
  const periodoLabel = ec.periodo.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  ```
  A:
  ```ts
  const periodoLabel = getPeriodoBilling(ec.periodo).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  ```
- **Línea 103:** El asunto del email ya usa `periodoLabel`, así que se corrige automáticamente.
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils`

### 5. `app/admin/estados-cuenta/actions.ts` — Asunto de notificación

- **Función:** `generarEstadoCuenta` (línea 17-153)
- **Línea 135:** Cambiar de:
  ```ts
  const periodoLabel = periodo.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  ```
  A:
  ```ts
  const periodoLabel = getPeriodoBilling(periodo).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils`

### 6. `app/propietario/estados-cuenta/page.tsx` — Listado del propietario

- **Función:** `EstadosCuentaPage` (componente server)
- **Línea 83:** Cambiar de:
  ```tsx
  {formatPeriodo(ec.periodo)}
  ```
  A:
  ```tsx
  {formatPeriodo(getPeriodoBilling(ec.periodo))}
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils` (ya importa `formatPeriodo`)

### 7. `app/propietario/dashboard/page.tsx` — Dashboard del propietario

- **Función:** `PropietarioDashboardPage` (componente server)
- **Línea 352 (dentro de `data.estadosCuenta.map`):** Cambiar de:
  ```tsx
  {formatPeriodo(ec.periodo)}
  ```
  A:
  ```tsx
  {formatPeriodo(getPeriodoBilling(ec.periodo))}
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils` (ya importa `formatPeriodo`)

### 8. `app/propietario/informar-pago/informar-pago-form.tsx` — Consumos pendientes

- **Función:** Renderizado de consumos pendientes
- **Línea 135:** Cambiar de:
  ```tsx
  {c.tipo} — {formatPeriodo(c.periodo)}
  ```
  A:
  ```tsx
  {c.tipo} — {formatPeriodo(getPeriodoBilling(c.periodo))}
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils`

### 9. `app/admin/informar-pago/informar-pago-form.tsx` — Consumos del EC (admin)

- **Función:** Renderizado de consumos
- **Línea 198:** Cambiar de:
  ```tsx
  {c.tipo} — {formatPeriodo(c.periodo)}
  ```
  A:
  ```tsx
  {c.tipo} — {formatPeriodo(getPeriodoBilling(c.periodo))}
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils`

### 10. `app/admin/validacion/validacion-client.tsx` — Consumos cubiertos por pago

- **Función:** Renderizado de consumos cubiertos
- **Línea 212:** Cambiar de:
  ```tsx
  <span style={{ color: "var(--on-surface)" }}>{c.tipo} — {formatPeriodo(c.periodo)}</span>
  ```
  A:
  ```tsx
  <span style={{ color: "var(--on-surface)" }}>{c.tipo} — {formatPeriodo(getPeriodoBilling(c.periodo))}</span>
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils`

### 11. `app/propietario/dashboard/page.tsx` — Labels del gráfico

- **Función:** Armado de data para gráficos
- **Línea 39:** Cambiar de:
  ```ts
  const label = formatPeriodoCorto(mes);
  ```
  A:
  ```ts
  const label = formatPeriodoCorto(getPeriodoBilling(mes));
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils` (ya importa `formatPeriodoCorto`)

### 12. `app/admin/estados-cuenta/page.tsx` — Leyenda en filtro de período

- **Función:** `EstadosCuentaPage` (componente server)
- **Línea ~50 (después del `<p>` de descripción):** Agregar leyenda:
  ```tsx
  <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: "var(--on-surface-muted)" }}>
    <span>💡</span>
    <span>
      Al seleccionar un período, se muestran los EC del mes anterior.
      Ej: {new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(getPeriodoBilling(periodo))}
      {" → ECs de "}
      {new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(periodo)}
    </span>
  </p>
  ```
- **Import:** Agregar `getPeriodoBilling` desde `@/lib/utils`

---

## Tests unitarios

**Archivo:** `tests/utils.test.ts` (ya existe)

Se agregan tests para `getPeriodoBilling`:

```ts
import { getPeriodoBilling } from "@/lib/utils";

describe("getPeriodoBilling", () => {
  it("decrements month by 1 for mid-year periods", () => {
    const result = getPeriodoBilling(new Date("2026-06-01"));
    expect(result.getMonth()).toBe(4); // Mayo (0-indexed)
    expect(result.getFullYear()).toBe(2026);
  });

  it("rolls back year when period is January", () => {
    const result = getPeriodoBilling(new Date("2026-01-01"));
    expect(result.getMonth()).toBe(11); // Diciembre
    expect(result.getFullYear()).toBe(2025);
  });

  it("preserves day component", () => {
    const result = getPeriodoBilling(new Date("2026-03-15"));
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(1); // Febrero
  });

  it("handles December correctly", () => {
    const result = getPeriodoBilling(new Date("2025-12-01"));
    expect(result.getMonth()).toBe(10); // Noviembre
    expect(result.getFullYear()).toBe(2025);
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-06-01");
    const original = input.getTime();
    getPeriodoBilling(input);
    expect(input.getTime()).toBe(original);
  });

  it("works with string-convertible dates", () => {
    const result = getPeriodoBilling(new Date("2026-08-01"));
    expect(result.getMonth()).toBe(6); // Julio
  });
});
```

---

## Archivos afectados (resumen)

| # | Archivo | Cambio | Líneas afectadas |
|---|---------|--------|-----------------|
| 1 | `lib/utils.ts` | Agregar `getPeriodoBilling` | Nueva función ~línea 49 |
| 2 | `app/api/ec/[id]/pdf/route.ts` | Usar helper para `periodoLabel` y `filename` | Líneas 48-49, 91 |
| 3 | `lib/pdf/estado-cuenta-pdf.tsx` | Modificar `fmtPeriodoCorto` para -1 mes | Líneas 59-63 |
| 4 | `lib/services/email.ts` | Usar helper en `periodoLabel` | Línea 54 |
| 5 | `app/admin/estados-cuenta/actions.ts` | Usar helper en asunto de notificación | Línea 135 |
| 6 | `app/propietario/estados-cuenta/page.tsx` | Usar helper en `formatPeriodo` | Línea 83 |
| 7 | `app/propietario/dashboard/page.tsx` | Usar helper en `formatPeriodo` + chart labels | Líneas 39, 352 |
| 8 | `app/propietario/informar-pago/informar-pago-form.tsx` | Usar helper en `formatPeriodo` | Línea 135 |
| 9 | `app/admin/informar-pago/informar-pago-form.tsx` | Usar helper en `formatPeriodo` | Línea 198 |
| 10 | `app/admin/validacion/validacion-client.tsx` | Usar helper en `formatPeriodo` | Línea 212 |
| 11 | `app/admin/estados-cuenta/page.tsx` | Agregar leyenda debajo del filtro | Después de línea 50 |
| 12 | `tests/utils.test.ts` | Tests unitarios para `getPeriodoBilling` | Nuevos tests |

---

## Rollback

1. Revertir commits del cambio
2. Las etiquetas vuelven a mostrar el período de corte original
3. Sin migración DB = sin riesgo de pérdida de datos
4. Los emails/PDFs nuevos volverán a usar el período de corte
