# Proposal: Mejoras condominio

## Intent

Agrupa 4 mejoras detectadas en producción: (1) la franquicia de agua es global (30 m³) cuando debería ser por parcela (30/15 m³), (2) los comunicados solo pueden ir a "todos" los propietarios (no a morosos ni parcelas específicas), (3) las lecturas de consumo no se pueden corregir tras importarlas, y (4) el botón de enviar comunicado permite dobles envíos (ocurrió: 8 correos). Decisiones de alcance YA confirmadas con el usuario.

## Scope

### In Scope

**1. Franquicia de agua por parcela (30/15 m³)**
- Campo `franquiciaAgua` en `Parcela` como enum de 2 valores fijos (p. ej. `TREINTA_M3`/`QUINCE_M3`), replicando el patrón `tipoGc` (schema.prisma:139-147).
- Eliminar `ConfiguracionSistema.franquiciaAguaM3` (schema:118) + su UI en `app/admin/configuracion/` (actions.ts:21,55, page.tsx:36, configuracion-form.tsx:11,116) + seed.ts:42.
- TODOS los puntos de cálculo leen la franquicia DE LA PARCELA (5 puntos, verificado por grep exhaustivo):
  1. `calcularConsumo` (`lib/services/consumos.ts:49`) — núcleo, usado por importación Excel Y `guardarLectura`
  2. `guardarLectura` (`app/admin/consumos/actions.ts:40`) — entrada manual de lecturas
  3. `generarEstadoCuenta` (`app/admin/estados-cuenta/actions.ts:52`) — recálculo al emitir EC
  4. `generarECSinNotificacion` (`app/admin/estados-cuenta/actions.ts:201`) — recálculo duplicado
  5. Los generadores masivos (`generarEstadosCuentaMasivo` L343, `generarEstadosCuentaMasivoSinNotificacion` L266) delegan en 3 y 4 → quedan cubiertos
  `calcularConsumo` ya recibe `parcelaId`; en flujos masivos pasar la parcela ya cargada para evitar query extra por fila.
- NO recalcular en: `vincular-consumos-ec` (script + API route), PDF, email, reportes — todos usan `totalAPagar`/subtotales snapshot almacenados.
- UI crear/editar parcela: select "Franquicia Agua" replicando el de tipoGc (propiedades-client.tsx:386-389) + columna/badge en la tabla.
- Migración one-time estilo `scripts/migrar-tipo-gc.ts`: parcelas existentes (47) → 30 m³.
- **Cambiar la franquicia solo afecta períodos futuros**: EC emitidos/pagados intactos (el PDF es snapshot de subtotales).

**2. Notificaciones selectivas (comunicado)**
- Destinatarios: (a) todos (actual), (b) morosos — parcela con `deudaTotal > 0` O con `estado_cuenta` EMITIDO sin pagar en el período actual → propietarios con dedupe multi-parcela, (c) **parcelas específicas seleccionadas manualmente (multi-select)** → propietarios de esas parcelas.
- UI: **tres opciones claras en el selector: "Todos los propietarios" / "Solo morosos" / "Seleccionar parcelas…"** — cuando elige "Seleccionar parcelas…" aparece un multi-select de parcelas activas con su propietario; `page.tsx` pasa las parcelas activas con propietario al cliente.
- Persistencia: setear `parcelaId` en `Notificacion` cuando el envío es por parcela específica (trazabilidad).
- Usuarios sin email siguen generando error "Sin email registrado".

**3. Edición de lecturas de consumos (AJAX)**
- Editar in-place `lecturaAnterior` y `lecturaActual` (solo esos 2 campos).
- Al guardar (Enter/blur): recalcular `consumoCalculado = max(0, actual - anterior)`, recalcular tarifa/monto con la MISMA lógica de `calcularConsumo` (incluye franquicia por parcela del cambio 1), guardar en BD, toast "Cambio realizado, datos actualizados", estado de carga y bloqueo de celdas durante el guardado.
- **Restricción**: solo consumos `PENDIENTE`; `CON_ESTADO_CUENTA`/`PAGADO` → no editables (input deshabilitado + tooltip).
- Nueva server action `actualizarLecturaConsumo`: auth ADMINISTRADOR + zod + `withErrorHandling` + `revalidatePath("/admin/consumos")` + `actualizarDeudasParcela`.

**4. Fix doble envío de comunicado**
- Causa raíz verificada: `disabled={isPending}` (notificaciones-client.tsx:250) solo cubre el `router.refresh()`, NO el await de `enviarComunicadoAction` → el botón queda habilitado durante el SMTP.
- UI: estado local `enviando` seteado ANTES del await + `disabled={enviando}` + texto "Enviando...".
- Servidor: protección idempotencia/rate-limit reutilizando `lib/ratelimit.ts` (mismo mecanismo que forgot-password, 5 intentos/15 min por identifier+acción).

### Out of Scope
- UI del propietario (no edita lecturas ni franquicia)
- Edición de otros campos del consumo (solo las 2 lecturas)
- Reenvío/reproceso de EC o PDF ya emitidos
- Tarifas globales de agua/luz (siguen en Configuración; solo cambia de dónde sale la franquicia)
- Migraciones SQL formales (proyecto usa `prisma db push` + scripts one-time)

## Capabilities

### New Capabilities
- `franquicia-agua-parcela`: franquicia de agua por parcela (30/15 m³) y su impacto en cálculo de consumos y recálculo de EC
- `notificaciones-comunicado`: destinatarios selectivos del comunicado (todos / morosos / parcelas específicas) y trazabilidad por parcela
- `edicion-lecturas-consumos`: edición AJAX de lecturas con recálculo y restricción por estado
- `envio-comunicado-seguro`: protección contra doble envío (estado UI + rate-limit/idempotencia en servidor)

### Modified Capabilities
None — no existen specs base en `openspec/specs/` (los cambios previos mantienen sus specs dentro de `openspec/changes/`).

## Approach

1. Schema: agregar `enum FranquiciaAgua` + `Parcela.franquiciaAgua @default(TREINTA_M3)`; eliminar `franquiciaAguaM3`; `prisma db push`.
2. Migración one-time `scripts/migrar-franquicia-agua.ts` → las 47 parcelas existentes en 30 m³.
3. `calcularConsumo` y recálculos de EC leen `parcela.franquiciaAgua` (pasando la parcela ya cargada en flujos masivos).
4. UI parcela: select "Franquicia Agua" + badge en tabla (patrón tipoGc).
5. `enviarComunicadoAction`: resolver destinatarios (todos/morosos/parcelas) con dedupe; setear `parcelaId`.
6. `consumos-client.tsx`: inputs editables con guardado AJAX vía `actualizarLecturaConsumo`; deshabilitados si estado ≠ PENDIENTE.
7. Botón enviar con estado `enviando`; rate-limit en `enviarComunicadoAction` (acción `enviar-comunicado`).
8. Actualizar `tests/services/consumos.test.ts` (mock de franquicia por parcela) + tests nuevos.

## Affected Areas

| Area | Impact | Descripción |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | +enum FranquiciaAgua, +`Parcela.franquiciaAgua`, −`franquiciaAguaM3` |
| `lib/services/consumos.ts` | Modified | `calcularConsumo` lee franquicia de la parcela (:49) |
| `app/admin/estados-cuenta/actions.ts` | Modified | recálculos EC (:52, :201) usan franquicia de parcela |
| `app/admin/configuracion/actions.ts`, `page.tsx`, `configuracion-form.tsx` | Modified | eliminar campo `franquiciaAguaM3` |
| `app/admin/propiedades/*` | Modified | select franquicia + columna en tabla (patrón tipoGc) |
| `app/admin/consumos/actions.ts` | Modified | +`actualizarLecturaConsumo`; `guardarLectura` usa franquicia de parcela (:40); revisar restricción PENDIENTE |
| `app/admin/consumos/consumos-client.tsx` | Modified | edición AJAX de lecturas |
| `app/admin/notificaciones/actions.ts` | Modified | destinatarios selectivos + `parcelaId` + rate-limit |
| `app/admin/notificaciones/page.tsx` | Modified | pasar parcelas activas al cliente |
| `app/admin/notificaciones/notificaciones-client.tsx` | Modified | selector destinatarios + fix doble envío |
| `lib/ratelimit.ts` | Modified | nueva acción `enviar-comunicado` (reuso) |
| `prisma/seed.ts` | Modified | quitar `franquiciaAguaM3` |
| `scripts/migrar-franquicia-agua.ts` | New | migración one-time (47 parcelas → 30 m³) |
| `tests/services/consumos.test.ts` | Modified | mocks de franquicia por parcela (:31, :60, :78) |

## Risks

| Risk | Prob. | Mitigación |
|------|-------|------------|
| Cambio 1: 4 puntos de cálculo tocan franquicia (consumos.ts + 2 EC + seed); 3 tests mockean `config.franquiciaAguaM3` y se rompen | Alta | Actualizar tests en el mismo cambio (TDD); el default de schema cubre parcelas nuevas |
| Cambio 1: `prisma db push` sobre BD con 47 parcelas sin migración → franquicia no definida | Media | Migración one-time obligatoria (estilo migrar-tipo-gc.ts) antes de activar UI |
| Cambio 2: definición de "morosos" (deudaTotal > 0 O EC EMITIDO sin pagar) puede incluir/excluir parcelas inesperadamente; envío no transaccional (N registros + emails en loop) | Media | Query única y testeable; dedupe multi-parcela; errores por destinatario sin abortar el resto |
| Cambio 3: editar lecturas de consumos CON_ESTADO_CUENTA/PAGADO descuadraría EC/Pago | Alta | Restricción PENDIENTE en UI + validación server-side; verificar que `guardarLectura` existente respete la restricción |
| Cambio 4: rate-limit bloquea otros flujos si no distingue la acción | Baja | identifier compuesto acción+usuario (`enviar-comunicado`) como en forgot-password |

## Rollback Plan

- Revertir commits por sub-cambio (git revert) — los 4 son independientes.
- Datos: `franquiciaAgua` no destruye datos; reversa = `prisma db push` quitando el campo + UPDATE `ConfiguracionSistema.franquiciaAguaM3 = 30`.
- EC emitidos no se tocan (invariante snapshot); rollback no exige re-emisión.
- Rate-limit se elimina quitando la llamada en `enviarComunicadoAction`.

## Dependencies

- Postgres local con 47 parcelas (copia de producción) para probar la migración.
- `lib/ratelimit.ts` existente (ya usado en forgot-password).

## Success Criteria

- [ ] La franquicia por parcela (30/15) se respeta en `calcularConsumo` y recálculos de EC; la UI de configuración ya no expone `franquiciaAguaM3`
- [ ] Migración one-time deja las 47 parcelas en 30 m³; cambiar franquicia no altera EC previos
- [ ] Comunicado envía a todos / morosos / parcelas específicas con dedupe y `parcelaId` persistido
- [ ] Lecturas editables solo en PENDIENTE, con recálculo correcto, toast y bloqueo durante el guardado
- [ ] Doble clic en enviar no produce envíos duplicados (UI + servidor)
- [ ] Tests actualizados y verdes; `npm run build` sin errores
