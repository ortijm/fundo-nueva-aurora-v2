# Tasks: Mejoras condominio

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas modificadas estimadas | 650–750 |
| Riesgo presupuesto 400 líneas | Alto |
| PRs encadenados recomendados | Sí |
| Split sugerido | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 |
| Estrategia de entrega | ask-on-risk |
| Estrategia de cadena | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + migración + cálculo (sub-cambios 1–2) | PR 1 | `npx vitest run tests/services/consumos.test.ts` | migración ×2 sobre postgres local (2ª = 0 updates) | revert commit 1; datos: `db push` reverso + UPDATE config |
| 2 | EC + guardias (sub-cambio 3) | PR 2 | `npx vitest run tests/services/consumos.test.ts` | reimport Excel con fila CON_ESTADO_CUENTA → error por fila | revert commit 2 |
| 3 | UI franquicia (sub-cambio 4) | PR 2 | `npx tsc --noEmit` | manual: /admin/configuracion sin campo; /admin/propiedades select + badge | revert commit 3 |
| 4 | Notificaciones servidor (sub-cambio 5) | PR 3 | `npx vitest run tests/services/notificaciones.test.ts tests/services/ratelimit.test.ts` | envío a morosos y parcelas en local | revert commit 4 |
| 5 | Notificaciones UI (sub-cambio 6) | PR 4 | `npx tsc --noEmit` | manual: modal 3 opciones, doble clic muestra "Enviando..." | revert commit 5 |
| 6 | Edición lecturas (sub-cambio 7) | PR 4 | `npx vitest run tests/services/consumos.test.ts` | manual: AJAX en PENDIENTE; rechazo CON_ESTADO_CUENTA | revert commit 6 |
| 7 | Cierre (sub-cambio 8) | PR 5 | `npm run build && npm run lint` | manual: 47 parcelas, morosos, EC previos intactos | N/A (sin código) |

## Phase 1: Fundación — schema, migración, seed (sub-cambio 1)

- [x] 1.1 En `prisma/schema.prisma`: agregar `enum FranquiciaAgua { M3_30 M3_15 }` + `Parcela.franquiciaAgua @default(M3_30)`; eliminar `ConfiguracionSistema.franquiciaAguaM3`
- [x] 1.2 `npx prisma db push` + `npx prisma generate`; quitar `franquiciaAguaM3: 30` de `prisma/seed.ts`
- [x] 1.3 Crear `scripts/migrar-franquicia-agua.ts` (todas las parcelas → `M3_30`, idempotente; estilo `migrar-tipo-gc.ts`)
- [x] 1.4 Ejecutar migración sobre copia local de 47 parcelas; verificar 2ª ejecución con 0 cambios

## Phase 2: Cálculo de consumo (sub-cambio 2, TDD)

- [x] 2.1 RED: en `tests/services/consumos.test.ts`, actualizar mocks de franquicia (M3_15: 18→3; M3_30: 25→0; `parcelaCargada` sin `findUnique` extra) — fallan
- [x] 2.2 GREEN: crear helper `calcularMontoAgua` en `lib/services/consumos.ts` (fuente única, dedupe con EC)
- [x] 2.3 GREEN: `calcularConsumo` usa `parcelaCargada?.franquiciaAgua` o fallback `findUnique`; flujos masivos pasan la parcela ya cargada

## Phase 3: Estados de cuenta y guardias (sub-cambio 3)

- [x] 3.1 `generarEstadoCuenta` (estados-cuenta/actions.ts:52): cargar parcela 1 vez (`franquiciaAgua` + `propietario`), recalcular con `calcularMontoAgua`; eliminar query duplicada L129
- [x] 3.2 `generarECSinNotificacion` (L201): usar parcela ya cargada (L168) + `calcularMontoAgua`
- [x] 3.3 Guardia en `guardarLectura` e `importarExcelConsumos`: rechazar upsert sobre consumo ≠ PENDIENTE (import: error por fila, sin abortar el resto)
- [x] 3.4 Test: reimport sobre CON_ESTADO_CUENTA rechazado; fila PENDIENTE corregible vía `lecturaAnteriorOverride`

## Phase 4: UI franquicia (sub-cambio 4)

- [x] 4.1 Quitar `franquiciaAguaM3` de `app/admin/configuracion/actions.ts`, `page.tsx` y `configuracion-form.tsx`
- [x] 4.2 Select "Franquicia Agua" en crear/editar parcela + badge/columna en tabla (patrón `tipoGc`, `propiedades-client.tsx`)

## Phase 5: Notificaciones servidor (sub-cambio 5, TDD)

- [x] 5.1 RED: crear `tests/services/notificaciones.test.ts` (morosos por deudaTotal; EC EMITIDO en período actual = último `PeriodoGasto`; sin PeriodoGasto → solo deuda; dedupe multi-parcela; `parcelaId` = mayor deudaTotal) — fallan
- [x] 5.2 GREEN: `resolverDestinatarios(opcion, parcelaIds?)` en `lib/services/notificaciones.ts` (queries constantes, aislada y testeable)
- [x] 5.3 `enviarComunicadoAction`: zod `destinatarios`/`parcelaIds`, validar "parcelas" sin selección, `checkRateLimit("enviar-comunicado:...")`, `Notificacion.parcelaId`, errores por destinatario sin abortar
- [x] 5.4 Test: extender `tests/services/ratelimit.test.ts` (agotar `enviar-comunicado` no bloquea `forgot-password`)

## Phase 6: Notificaciones UI (sub-cambio 6)

- [x] 6.1 `page.tsx`: prop `parcelasActivas` (activas con propietario) al cliente
- [x] 6.2 Modal con 3 opciones + multi-select en `notificaciones-client.tsx`; "Seleccionar parcelas…" sin selección → error
- [x] 6.3 `enviando` antes del await; botón `disabled` con "Enviando..."; toast de resultado (éxito / errores parciales)

## Phase 7: Edición de lecturas (sub-cambio 7)

- [x] 7.1 `actualizarLecturaConsumo` en `app/admin/consumos/actions.ts`: auth ADMINISTRADOR, zod ≥ 0, guardia estado PENDIENTE, recalcular con parcela cargada, `actualizarDeudasParcela`, `revalidatePath`
- [x] 7.2 `consumos-client.tsx`: inputs controlados solo `lecturaAnterior`/`lecturaActual` en PENDIENTE; disabled + tooltip en CON_ESTADO_CUENTA/PAGO_INFORMADO/PAGADO
- [x] 7.3 Guardado en Enter/blur → toast "Cambio realizado, datos actualizados"; bloqueo de celdas durante guardado; error conserva valores editados

## Phase 8: Cierre (sub-cambio 8)

- [x] 8.1 `npm run build` + `npm run lint` + `npx tsc --noEmit` sin errores
- [x] 8.2 Verificación manual: 47 parcelas en 30 m³, envío morosos/parcelas con dedupe, doble clic sin duplicados, edición solo PENDIENTE, EC previos intactos
