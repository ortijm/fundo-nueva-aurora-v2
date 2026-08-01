# Design: Mejoras condominio

## 1. Resumen / Contexto

Cuatro mejoras detectadas en producción, agrupadas en un solo cambio con 4 sub-cambios independientes y commiteables por separado:

1. **Franquicia de agua por parcela** (`specs/franquicia-agua-parcela.md`): la franquicia pasa de global (`ConfiguracionSistema.franquiciaAguaM3`) a un campo `franquiciaAgua` en `Parcela` con dos valores fijos (30/15 m³). Todos los puntos que calculan consumo o recalcular estados de cuenta leen la franquicia DE LA PARCELA, sin consultas extra por fila en flujos masivos. Migración one-time de las 47 parcelas existentes a 30 m³.
2. **Notificaciones selectivas** (`specs/notificaciones-comunicado.md`): el comunicado admite tres tipos de destinatarios — todos / solo morosos / parcelas específicas (multi-select) — con dedupe multi-parcela, trazabilidad `parcelaId` y una query única testeable.
3. **Edición de lecturas** (`specs/edicion-lecturas-consumos.md`): edición AJAX in-place de `lecturaAnterior`/`lecturaActual` con recálculo idéntico a `calcularConsumo` y restricción estricta: solo consumos `PENDIENTE` editables, validado también en servidor.
4. **Envío seguro** (`specs/envio-comunicado-seguro.md`): bloqueo en UI (`enviando` antes del await) + rate-limit en servidor con `checkRateLimit`, eliminando el doble envío ocurrido en producción (8 correos).

La estrategia técnica replica los patrones existentes: enum en `Parcela` (patrón `tipoGc`, schema:139-147), server actions con `withErrorHandling`, migración one-time estilo `scripts/migrar-tipo-gc.ts`, `prisma db push` (el proyecto no usa migraciones SQL formales).

## 2. Decisiones de diseño

### Decisión 1: Enum de franquicia — `FranquiciaAgua { M3_30, M3_15 }`

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| `FranquiciaAgua { M3_30, M3_15 }` | Valores numéricos explícitos, unidad embebida, orden lexicográfico estable (`M3_15` < `M3_30`) | ✅ Elegido |
| `FranquiciaAgua { TREINTA_M3, QUINCE_M3 }` | Mezcla español/inglés en un valor que es una cantidad; "TREINTA" es más largo y menos legible | ❌ Rechazado |

**Justificación**: los enums existentes (`EstadoConsumo`, `TipoGastoComun`, `EstadoParcela`) usan palabras descriptivas en español porque representan **conceptos** (NORMAL, REDUCIDO, PENDIENTE). Esta franquicia es una **cantidad con unidad** (30 m³): el número no necesita traducción y `M3_30`/`M3_15` es neutral al idioma, inequívoco y autodocumentado. `M3_15` < `M3_30` da orden estable para selects y badges. Cumple la especificación ("exactamente dos valores fijos", nombre definido por el diseño).

### Decisión 2: Firma de `calcularConsumo` — parámetro `parcelaCargada?` opcional

| Opción | Tradeoff | Decisión |
|--------|----------|----------|
| `parcelaCargada?: Pick<Parcela, "id" \| "franquiciaAgua">` opcional | Flujos masivos pasan la parcela que YA cargaron (0 queries extra); flujos unitarios omiten y resuelven con 1 `findUnique` `select` | ✅ Elegido |
| Parametrizar `franquiciaAgua` como argumento | El llamador debe conocerla; duplica la resolución en cada punto y arriesga divergencia con el fallback | ❌ Rechazado |
| `prisma.parcela.findUnique` interno incondicional | N+1 en import masivo (47 filas) y EC masivos; viola Escenario 6 de la spec | ❌ Rechazado |

**Firma final** (`lib/services/consumos.ts`):

```typescript
export async function calcularConsumo(
  parcelaId: string,
  tipoConsumoId: string,
  periodo: Date,
  lecturaActual: number,
  lecturaAnteriorOverride?: number,
  parcelaCargada?: Pick<Parcela, "id" | "franquiciaAgua"> // ← nuevo, último parámetro (compatibilidad)
): Promise<{ lecturaAnterior; lecturaActual; consumoCalculado; tarifaAplicada; montoConsumo; cargoFijo; totalAPagar }>
```

**Resolución interna**: `parcelaCargada?.franquiciaAgua` si viene; si no, `findUnique({ where: { id: parcelaId }, select: { franquiciaAgua: true } })`; si la parcela no existe → `throw new Error("Parcela no encontrada")` (consistente con el throw de tipoConsumo). El default del schema (`M3_30`) + la migración garantizan que el valor nunca es null.

**Llamadas por punto**:
- `importarExcelConsumos` (consumos/actions.ts:212): ya carga la parcela por fila (L200) → la pasa tal cual → **0 queries adicionales por fila**. (El `findUnique` por fila de L200 es preexistente y no se agrava.)
- `guardarLectura` (L40): flujo unitario → omite el parámetro y usa el fallback (1 query por guardado, aceptable).
- `generarECSinNotificacion` (estados-cuenta/actions.ts:168): ya carga la parcela con consumos → la pasa.
- `generarEstadoCuenta`: hoy NO carga la parcela al inicio (la carga en L129 solo para la notificación). Se modifica para cargarla UNA vez al inicio con `franquiciaAgua` + `propietario`, eliminando además la query duplicada de L129.

### Decisión 3: Query única de destinatarios morosos

**Definición de negocio (spec)**: parcela `ACTIVA` con `deudaTotal > 0` **O** con un `estado_cuenta` en estado `EMITIDO` sin pagar en el período actual.

**"Período actual"** = el `periodo` del último registro en `PeriodoGasto` (`periodos_gasto`), la tabla que se actualiza al generar el período. Si no existe ningún `PeriodoGasto`, se aplica solo la condición de `deudaTotal > 0` (la condición EC queda inactiva, no rompe el envío).

**Query única** (`lib/services/notificaciones.ts`, función aislada y testeable — Requisito 5):

```typescript
export type OpcionDestinatarios = "todos" | "morosos" | "parcelas";

export interface DestinatarioResuelto {
  usuario: { id: string; email: string | null; firstName: string; lastName: string; username: string };
  parcelaId: string | null; // trazabilidad; null para "todos"
}

export async function resolverDestinatarios(
  opcion: OpcionDestinatarios,
  parcelaIdsSeleccionadas?: string[]
): Promise<DestinatarioResuelto[]>
```

```typescript
// Opción "morosos" — 2 queries constantes (periodoGasto + parcelas), independiente del nº de parcelas
const periodoActual = await prisma.periodoGasto.findFirst({
  orderBy: { periodo: "desc" },
  select: { periodo: true },
});

const parcelas = await prisma.parcela.findMany({
  where: {
    estado: "ACTIVA",
    propietarioId: { not: null },
    OR: [
      { deudaTotal: { gt: 0 } },
      ...(periodoActual
        ? [{ estadosCuenta: { some: { estado: "EMITIDO", periodo: periodoActual.periodo } } }]
        : []),
    ],
  },
  select: {
    id: true, numero: true, deudaTotal: true,
    propietario: { select: { id: true, email: true, firstName: true, lastName: true, username: true } },
  },
});
```

**Dedupe multi-parcela**: agrupar por `propietario.id` con `Map` en JS (un propietario = una notificación).

**`parcelaId` persistido en `Notificacion`**: la parcela del propietario con **mayor `deudaTotal`** entre sus parcelas morosas (criterio de negocio: la más representativa de la morosidad); desempate por `numero` ascendente. La misma regla se aplica en la opción "parcelas" (entre las parcelas seleccionadas del mismo propietario). Con la opción "todos", `parcelaId` queda null (Requisito 6).

**Otras opciones**:
- "todos": `prisma.usuario.findMany({ where: { rol: "PROPIETARIO", isActive: true, parcelas: { some: { estado: "ACTIVA" } } } })` (1 query). **Sin filtro `email: { not: null }`** (hoy existe en actions.ts:78): se elimina porque el Requisito 7 exige que un usuario sin email genere `Notificacion` ERROR "Sin email registrado" sin abortar el envío.
- "parcelas": `findMany({ where: { id: { in: parcelaIds }, estado: "ACTIVA", propietarioId: { not: null } }, include: { propietario } })` (1 query) → dedupe por propietario.

### Decisión 4: `PAGO_INFORMADO` NO es editable

**Confirmado por spec** (Requisito 4 de edicion-lecturas): solo `PENDIENTE` es editable. `CON_ESTADO_CUENTA`, `PAGO_INFORMADO` y `PAGADO` quedan deshabilitados en UI y rechazados en servidor (la validación server-side es la que protege el EC, no la UI).

**Validación server-side en `actualizarLecturaConsumo`** (orden estricto):
1. `auth()` + rol `ADMINISTRADOR` → `unauthorized()`.
2. Zod: `consumoId` + `lecturaAnterior`/`lecturaActual` números `>= 0` (rechaza negativos y no numéricos).
3. `prisma.consumoMensual.findUnique({ where: { id }, include: { parcela: { select: { franquiciaAgua: true } } } })`.
4. Guardias: consumo inexistente → error; `estado !== "PENDIENTE"` → error `"El consumo ya está asociado a un estado de cuenta o pago y no puede editarse"`.
5. Recalcular y persistir (ver sección 6).

**Defensa adicional (riesgo de la propuesta)**: `guardarLectura` e `importarExcelConsumos` hacen `upsert` incondicional → reimportar puede sobrescribir consumos `CON_ESTADO_CUENTA`/`PAGADO` y descuadrar EC emitidos. Se agrega la misma guardia: si existe consumo previo en el upsert con estado ≠ `PENDIENTE` → rechazar (en el import: error por fila y continuar). Esto cambia deliberadamente el comportamiento actual del reimport ("permite corregir al reimportar") para proteger la invariante del EC; el reimport sigue permitiendo corregir filas `PENDIENTE` vía `lecturaAnteriorOverride`.

### Decisión 5: Rate-limit en `enviarComunicadoAction`

**Corrección verificada**: la función real de `lib/ratelimit.ts` es `checkRateLimit(identifier, action)` (no `rateLimit`). Se integra al inicio del bloque `withErrorHandling`, ANTES de resolver destinatarios o enviar correos, replicando el patrón de forgot-password (app/api/auth/forgot-password/route.ts:18-25):

```typescript
const rateCheck = await checkRateLimit(`enviar-comunicado:${session.user.id}`, "enviar-comunicado");
if (!rateCheck.allowed) {
  const minutes = Math.ceil(rateCheck.resetIn / 60000);
  return { success: false, error: `Demasiados intentos. Intenta de nuevo en ${minutes} minutos.` };
}
```

- **Identifier** = `enviar-comunicado:${session.user.id}` (userId del admin), **acción** = `"enviar-comunicado"` → el límite es por usuario y por acción.
- **Aislamiento** (Requisito 4): la unicidad `@@unique([identifier, action])` del modelo `RateLimit` separa los contadores por acción; agotar `enviar-comunicado` no bloquea `forgot-password`.
- Cada invocación cuenta un intento (mecánica existente); no hay `resetRateLimit` al éxito (igual que forgot-password). 5 intentos/15 min es un techo razonable para un admin.

## 3. Modelo de datos

```prisma
enum FranquiciaAgua {
  M3_30
  M3_15
}

model Parcela {
  // ... campos existentes
  franquiciaAgua FranquiciaAgua @default(M3_30)
}

model ConfiguracionSistema {
  // − franquiciaAguaM3 Decimal @default(30) @db.Decimal(8, 2)   ← ELIMINAR
}
```

Cambios de archivo:
- `prisma/schema.prisma`: + enum, + campo en Parcela, − campo en ConfiguracionSistema.
- `prisma/seed.ts:42`: eliminar `franquiciaAguaM3: 30`.
- Aplicación: `npx prisma db push` + `npx prisma generate`.

**Nota**: al agregar la columna con `@default`, `prisma db push` asigna `M3_30` a las filas existentes. El script one-time es garantía explícita + auditoría idempotente.

**Script one-time** `scripts/migrar-franquicia-agua.ts` (estructura estilo `migrar-tipo-gc.ts`):

```typescript
// USAGE: npx tsx scripts/migrar-franquicia-agua.ts
import { prisma } from "../lib/prisma";

async function main() {
  const parcelas = await prisma.parcela.findMany({
    select: { id: true, numero: true, franquiciaAgua: true },
  });
  console.log(`📦 ${parcelas.length} parcelas encontradas`);

  let actualizadas = 0;
  for (const p of parcelas) {
    if (p.franquiciaAgua !== "M3_30") {
      await prisma.parcela.update({
        where: { id: p.id },
        data: { franquiciaAgua: "M3_30" },
      });
      actualizadas++;
      console.log(`  Parcela ${p.numero} → M3_30`);
    }
  }
  console.log(`✅ ${actualizadas}/${parcelas.length} parcelas ajustadas a M3_30`);
}

main().catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

**Idempotencia**: solo actualiza parcelas que no sean `M3_30`; la segunda ejecución produce 0 cambios (Escenario 4 de la spec). Se recorre TODAS las parcelas (activas e inactivas) porque el requisito exige que "TODAS las parcelas existentes" queden en 30 m³ (a diferencia de `migrar-tipo-gc.ts`, que filtraba por ACTIVA).

**Rollback**: `git revert` por sub-cambio; para datos, `prisma db push` quitando el campo + `UPDATE configuracion_sistema SET franquicia_agua_m3 = 30`. EC emitidos/pagados no se tocan (snapshot).

## 4. Cálculo de consumo

**Helper puro nuevo** en `lib/services/consumos.ts` (elimina la duplicación actual entre consumos.ts:51-57 y estados-cuenta/actions.ts:52-60 y 201-209):

```typescript
export function calcularMontoAgua(
  consumoCalculado: number,
  franquiciaM3: number, // 30 | 15
  config: Pick<ConfiguracionSistema, "tarifaAgua1_10" | "tarifaAgua11_20" | "tarifaAgua21_30" | "tarifaAgua31_40" | "tarifaAgua41mas">
): number
```

Internamente: `sobreconsumo = max(0, consumoCalculado - franquiciaM3)` → `calcularMontoAguaTramos(sobreconsumo, tarifas)` (tarifa única no progresiva, como hoy). `calcularConsumo` usa el helper; los recálculos de EC también → una sola fuente de verdad.

**En `calcularConsumo`** (agua, reemplazo de consumos.ts:49):

```typescript
const franquiciaM3 = franquiciaAgua === "M3_30" ? 30 : 15;
const sobreconsumo = Math.max(0, consumoCalculado - franquiciaM3);
montoConsumo = calcularMontoAgua(consumoCalculado, franquiciaM3, config);
```

**Actualización de los 5 puntos**:

| # | Punto | Cambio |
|---|-------|--------|
| 1 | `calcularConsumo` (consumos.ts:21-75) | Franquicia desde `parcelaCargada` o fallback `findUnique` (Decisión 2) |
| 2 | `guardarLectura` (consumos/actions.ts:40) | Delega en `calcularConsumo` (fallback) + guardia estado ≠ PENDIENTE |
| 3 | `generarEstadoCuenta` (estados-cuenta/actions.ts:52) | Carga parcela 1 vez al inicio (`franquiciaAgua` + `propietario`), recalcula con `calcularMontoAgua` y franquicia de parcela; elimina la query duplicada de L129 |
| 4 | `generarECSinNotificacion` (L201) | Usa la parcela YA cargada (L168) + `calcularMontoAgua` |
| 5 | `generarEstadosCuentaMasivo` (L343) y `generarEstadosCuentaMasivoSinNotificacion` (L266) | Delegan en 3/4 → quedan cubiertos, sin reintroducir `config.franquiciaAguaM3` |

**Invariante snapshot** (Requisito 5 spec): `consumoCalculado = max(0, actual − anterior)` es independiente de la franquicia; la franquicia solo afecta `montoConsumo` y subtotales. EC emitidos/pagados conservan sus montos almacenados; el cambio de franquicia impacta solo consumos y EC generados desde el próximo período.

## 5. Notificaciones

**Resolución de destinatarios**: helper `resolverDestinatarios(opcion, parcelaIds?)` en `lib/services/notificaciones.ts` (Decisión 3). Invocado desde `enviarComunicadoAction`; cada opción usa queries constantes, sin bucles por parcela.

**`enviarComunicadoAction`** (app/admin/notificaciones/actions.ts) — cambios:

```typescript
const enviarComunicadoSchema = z.object({
  asunto: z.string().min(1, "Asunto requerido"),
  mensaje: z.string().min(1, "Mensaje requerido"),
  destinatarios: z.enum(["todos", "morosos", "parcelas"]),
  parcelaIds: z.array(z.string().min(1)).optional(),
});
```

- FormData: `destinatarios` + `formData.getAll("parcelaIds")` (checkboxes).
- Validación: opción "parcelas" sin `parcelaIds` → error `"Selecciona al menos una parcela"` (Requisito 1).
- Rate-limit al inicio del `withErrorHandling` (Decisión 5).
- Loop de envío por destinatario (try/catch individual, sin abortar el resto), `Notificacion.create` con `parcelaId: d.parcelaId` (trazabilidad; null en "todos").
- Resultado: `{ success, ok, errores, erroresDetalle: string[] }` — reporta los destinatarios con error (Requisito 7).

**UI del modal** (notificaciones-client.tsx):
- Selector de 3 opciones: "Todos los propietarios" / "Solo morosos" / "Seleccionar parcelas…".
- Al elegir "Seleccionar parcelas…" → multi-select (checkboxes) de parcelas activas con propietario (solo `propietarioId != null`).
- Botón enviar con estado `enviando` (sección 7).

**Datos que `page.tsx` pasa al cliente** (nueva prop `parcelasActivas`):

```typescript
const parcelasActivas = await prisma.parcela.findMany({
  where: { estado: "ACTIVA", propietarioId: { not: null } },
  select: {
    id: true, numero: true, nombre: true,
    propietario: { select: { id: true, firstName: true, lastName: true, username: true } },
  },
  orderBy: { numero: "asc" },
});
// → [{ id, numero, nombre, propietario: "Nombre Apellido" | null }]
```

## 6. Edición de lecturas

**Server action** `actualizarLecturaConsumo(consumoId, lecturaAnterior, lecturaActual)` en app/admin/consumos/actions.ts:

```typescript
const actualizarLecturaSchema = z.object({
  consumoId: z.string().min(1, "Consumo requerido"),
  lecturaAnterior: z.number().min(0, "La lectura anterior no puede ser negativa"),
  lecturaActual: z.number().min(0, "La lectura actual no puede ser negativa"),
});
```

Flujo (todo dentro de `withErrorHandling`):
1. auth + rol ADMINISTRADOR.
2. Zod (rechaza negativos/no numéricos).
3. `findUnique` consumo con `include: { parcela: { select: { franquiciaAgua: true } } }`.
4. Guardias: inexistente → error; `estado !== "PENDIENTE"` → error (cubre `CON_ESTADO_CUENTA`, `PAGO_INFORMADO`, `PAGADO`).
5. `calcularConsumo(consumo.parcelaId, consumo.tipoConsumoId, consumo.periodo, lecturaActual, lecturaAnterior, consumo.parcela)` — `lecturaAnterior` como override → `consumoCalculado = max(0, actual − anterior)`, monto con franquicia de la parcela (Decisión 2, sin query extra).
6. `prisma.consumoMensual.update` (campos de cálculo + `registradoPorId`).
7. `actualizarDeudasParcela(consumo.parcelaId)`.
8. `revalidatePath("/admin/consumos")`.

**Componentes cliente** (consumos-client.tsx, TablaResumen L178-311 y TablaDetalle L314-397):
- Cuando existe consumo (`hasLectura`), las celdas `lecturaAnterior`/`lecturaActual` pasan de texto estático a inputs controlados si `estado === "PENDIENTE"`; si no, inputs `disabled` con tooltip `title="Consumo asociado a estado de cuenta o pago"` (Requisito 4).
- Solo esos 2 campos son editables; tarifa, consumo y montos siguen estáticos (Requisito 1).
- Estado local: `edicion: Record<rowKey, { anterior: string; actual: string }>` + `guardando: rowKey | null`.
- Guardado en Enter o blur → `actualizarLecturaConsumo(id, anterior, actual)` → toast "Cambio realizado, datos actualizados" (éxito) o toast de error conservando los valores editados → `router.refresh()`.
- Durante `guardando === rowKey`: inputs deshabilitados (bloquea doble guardado — Escenario 7).

## 7. Envío seguro

**UI** (notificaciones-client.tsx:37-52, hoy con `disabled={isPending}` que solo cubre el `router.refresh()`):
- `const [enviando, setEnviando] = useState(false)`.
- En `handleSubmit`: `setEnviando(true)` ANTES del `await enviarComunicadoAction(fd)`; `try { ... } finally { setEnviando(false) }` (causa raíz verificada del doble envío).
- Botón: `disabled={enviando || isPending}` + contenido `{enviando ? "Enviando..." : "Enviar"}` (Requisito 1, Escenarios 1-2).
- Toast de resultado: éxito con destinatarios alcanzados; errores parciales con `erroresDetalle` resumidos (Requisito 2).

**Servidor**: `checkRateLimit` al inicio (Decisión 5). UI + servidor juntos garantizan una sola entrega por intención (Requisito 5).

## 8. Estrategia de tests

**Actualizar** `tests/services/consumos.test.ts` (los 3 tests rompen al quitar `config.franquiciaAguaM3`, L31/L60/L78):
- Mock de `prisma.parcela.findUnique` (fallback) y `franquiciaAgua` en el mock de `@/lib/prisma`.
- Tests existentes pasan con parcela de franquicia M3_30.

**Nuevos tests**:
| Archivo | Qué cubre | Enfoque |
|---------|-----------|---------|
| `tests/services/consumos.test.ts` (extendido) | Franquicia M3_15: 18 m³ → 3 facturables (Escenario 1 spec); M3_30 dentro de límite: 25 → 0 (Escenario 2); `parcelaCargada` evita `findUnique` extra (assert de que el mock NO se llama al pasar parcela); `calcularMontoAgua` por tramo | Unit (mocks prisma) |
| `tests/services/notificaciones.test.ts` (nuevo) | Query morosos: deudaTotal>0; EC EMITIDO en período actual vía PeriodoGasto; sin PeriodoGasto → solo deuda; dedupe multi-parcela (1 notificación); `parcelaId` = max deudaTotal; opción "parcelas" con dedupe; "todos" sin duplicados | Unit (mocks prisma) |
| `tests/services/ratelimit.test.ts` (extendido) | Aislamiento de acciones: agotar `enviar-comunicado` no afecta `forgot-password` (Requisito 4) | Unit (mocks prisma) |
| Migración | Idempotencia del script (2ª ejecución = 0 updates) | Unit sobre la lógica o verificación manual con las 47 parcelas (postgres local) |

**Verificación manual** (specs de UI): edición AJAX con bloqueo de celdas, doble clic en enviar, modal de 3 opciones, select de franquicia en propiedades, `npm run build`.

## 9. Orden de implementación

1. **Schema**: enum + campo Parcela − campo config; `prisma db push` + `prisma generate`; `scripts/migrar-franquicia-agua.ts`; quitar `franquiciaAguaM3` del seed.
2. **Cálculo**: `calcularConsumo` (Decisión 2) + helper `calcularMontoAgua` + actualizar tests → verdes (TDD).
3. **EC**: recalcular `generarEstadoCuenta`/`generarECSinNotificacion` con franquicia de parcela + guardias estado ≠ PENDIENTE en `guardarLectura`/`importarExcelConsumos`.
4. **UI franquicia**: quitar campo de configuración (actions/page/form) + select y badge en propiedades (patrón tipoGc).
5. **Notificaciones servidor**: `resolverDestinatarios` + `enviarComunicadoAction` (destinatarios selectivos, parcelaId, rate-limit) + tests.
6. **Notificaciones UI**: modal 3 opciones + multi-select + estado `enviando` + toast de resultado.
7. **Edición lecturas**: `actualizarLecturaConsumo` + inputs AJAX en consumos-client.
8. **Cierre**: `npm run build`, `npm run lint`, verificación manual (47 parcelas, morosos, doble clic, PENDIENTE-only).

Cada sub-cambio es un commit independiente → rollback por `git revert` sin afectar los demás.

## 10. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| 4 puntos de cálculo tocan franquicia; 3 tests mockean `config.franquiciaAguaM3` y se rompen | Alta | Actualizar tests en el mismo sub-cambio (TDD, paso 2); default `M3_30` del schema cubre parcelas nuevas |
| `prisma db push` sobre BD con 47 parcelas sin asignación | Media | La columna con `@default` asigna M3_30 automáticamente; script one-time idempotente lo garantiza y audita antes de activar UI |
| Definición de "morosos" (deudaTotal O EC EMITIDO período actual) con inclusión/exclusión inesperada; envío no transaccional | Media | Query única testeable; "período actual" fijado a último `PeriodoGasto` (regla documentada); errores por destinatario sin abortar el resto |
| **"Período actual" desactualizado** si el admin genera EC sin generar GC del período (PeriodoGasto atrasado) | Baja | Regla con fallback: sin PeriodoGasto → solo condición deudaTotal (no rompe el envío); asunción a confirmar con el usuario en revisión |
| Editar consumos CON_ESTADO_CUENTA/PAGO_INFORMADO/PAGADO descuadra EC/Pago | Alta | Restricción PENDIENTE en UI + validación server-side; **nueva guardia** en `guardarLectura`/`importarExcelConsumos` (upsert no puede sobrescribir consumos no-PENDIENTE) — cambio deliberado del reimport |
| Rate-limit bloquea otros flujos si no distingue acción | Baja | `@@unique([identifier, action])` con action `enviar-comunicado` (patrón forgot-password); test de aislamiento |
| Doble envío residual pese a bloqueo UI | Baja | `enviando` antes del await (fix de causa raíz) + rate-limit 5/15 min en servidor |

**Decisiones confirmadas con el usuario (2026-07-31)**:
- [x] "Período actual" = último `PeriodoGasto` — confirmado.
- [x] `parcelaId` persistido = parcela con mayor `deudaTotal` — confirmado.
- [x] Nueva guardia en `guardarLectura`/`importarExcelConsumos` (no sobrescribir consumos ≠ PENDIENTE al reimportar) — confirmado. Cambio deliberado del comportamiento del reimport.
