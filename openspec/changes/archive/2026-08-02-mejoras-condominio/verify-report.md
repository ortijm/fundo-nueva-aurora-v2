# SDD Verify Report — mejoras-condominio

status: success (PASS WITH WARNINGS) | 25/25 requisitos, 27/27 escenarios (13 COMPLIANT, 14 PARTIAL), 0 CRITICAL, 3 WARNING, 3 SUGGESTION

> Restored from Engram observation `sdd/mejoras-condominio/verify-report` (obs-52) at archive time —
> sdd-verify persisted this report to Engram only, not to the filesystem.

## Verificación independiente (no se confió en apply-progress)
- `npm run test` (vitest 4.1.6): 76/76 passed, 9 files, exit 0 (hash ffc2410d542755b1c8e41393e9879291f12b240dfbb87d08701d981ecf402ffd)
- `npx tsc --noEmit`: 0 errores, exit 0
- `npm run lint`: 0 errores, 1 warning preexistente (unused eslint-disable consumos-client.tsx L3)
- `npm run build`: exit 0, solo warning middleware→proxy de Next 16.2.1 (fuera de scope) (hash 88ab3bbdae41faf32b996cc4749ebf62709e0bcf4d5ce5d0e9f72a135dfb161c)
- `npm run test:coverage`: notificaciones.ts 100% lines, consumos.ts 73.33% (líneas no cubiertas = paths preexistentes luz L101-103 y actualizarDeudasParcela L119-150, NO la lógica nueva de franquicia), utils.ts 90.32%
- BD local read-only: 47/47 parcelas M3_30 (0 M3_15, 0 NULL) — migración aplicada; configuracion_sistema 0 columnas franquicia; rate_limits solo forgot-password (13), 0 enviar-comunicado (sin correos reales)
- grep franquiciaAguaM3/franquicia_agua_m3: 0 matches en app/lib/prisma/components/tests/scripts (solo docs openspec)

## Invariantes verificados (código + tests)
1. Franquicia: calcularConsumo usa parcelaCargada?.franquiciaAgua (consumos.ts L86) o fallback findUnique (L88-94); calcularMontoAgua (L41-54) es fuente única (usado en EC actions.ts L61 y L197); 0 refs a config.franquiciaAguaM3 ✅
2. Guardias: guardarLectura (actions.ts L41-47) e importarExcelConsumos (L218-225) rechazan upsert sobre consumo ≠ PENDIENTE (error por fila en import); actualizarLecturaConsumo (L284-286) solo edita PENDIENTE ✅ (Decisión 4 confirmada por usuario)
3. Notificaciones: resolverDestinatarios (lib/services/notificaciones.ts) dedupe por propietario (Map L35-46), parcelaId = mayor deudaTotal con desempate numero asc (L26-32, confirmado por usuario), "todos" → parcelaId null y SIN filtro email (R7), 2 queries constantes morosos (L50-72), checkRateLimit("enviar-comunicado:${userId}", "enviar-comunicado") al inicio (actions.ts L82-86), aislamiento @@unique([identifier,action]) schema L22 ✅
4. UI: setEnviando(true) ANTES del await (notificaciones-client.tsx L65-66) + try/finally + disabled={enviando||isPending} + "Enviando..." (L345-350); modal 3 opciones (L271-273); inputs solo lecturaAnterior/lecturaActual en PENDIENTE con tooltip (consumos-client.tsx L129-161, editable = estado==="PENDIENTE") ✅
5. Diseño: D1 enum M3_30/M3_15 (schema L143-146), D2 parcelaCargada opcional, D3 query única, D4 PAGO_INFORMADO no editable, D5 rate-limit al inicio — todos seguidos. Confirmados usuario 1-2-3 (período=último PeriodoGasto, parcelaId=mayor deudaTotal, guardia reimport) ✅
6. Snapshot EC: 136/136 EC con montos coherentes (apply WU5) + 0 consumos PENDIENTE actuales en BD

## Findings
CRITICAL: None.
WARNING:
- W1: actualizarLecturaConsumo sin test directo (edicion-lecturas E3-E6: rechazo no-PENDIENTE, auth, zod). Invariante cubierto por inspección + tests hermanos (tests/actions/consumos.test.ts sobre guardarLectura/importarExcelConsumos), pero la acción en sí no tiene covering test → PARTIAL.
- W2: envio-comunicado-seguro E1/E2/E5/E6 verificados estructuralmente (código), sin harness de browser; el rate-limit server-side sí está testeado (ratelimit.test.ts incl. aislamiento E4).
- W3: consumos.ts < 80% lines coverage (73.33%) — solo paths preexistentes descubiertos.
SUGGESTION:
- S1: TDD Cycle Evidence en obs-42 (apply-progress mergeado) solo retiene filas WU5; RED/GREEN de WU1-4 no quedó en el artefacto final.
- S2: 0 integration/E2E tests (9 files 100% unit con prisma mockeado); UI flows (modal 3 opciones, AJAX) solo verificación estructural.
- S3: Escenario 8 notificaciones (parcela sin propietario) cubierto solo por código (propietarioId not null).

## Test layer distribution
Unit: 76/9 files | Integration: 0 | E2E: 0

## Assertion quality
✅ Sin tautologías, sin ghost loops, sin smoke tests, sin assertions de clases CSS; los 3 tests "empty" tienen companions no-empty; valores reales (montoConsumo = 3*2000, totalAPagar = 6000, etc.)

## Verdict
PASS WITH WARNINGS — implementación coincide con specs/design/tasks; warnings no bloquean (gaps de cobertura de test, no fallas de invariantes).

## next_recommended
ARCHIVE (sdd-archive). Warnings documentados para mejora futura; no se requiere fix-then-verify.

## Commits verificados
41b14a2 (PR1 schema+migración+cálculo), 7e93b7f (PR2 EC+guardias+UI franquicia), 65b6e2c (PR3 notificaciones server), d5a032a (PR4 UI notificaciones+edición lecturas), 0d9f059/2b11e36 (docs tasks). Rama main. Sin scope creep (diff 2017+/136-, solo archivos de Affected Areas + lib/utils.ts + tests + openspec).
