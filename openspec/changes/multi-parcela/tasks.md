# Tasks: Multi-Parcela Support

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200-250 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Decision needed before apply: No
| Chained PRs recommended: No
| Chain strategy: size-exception
| 400-line budget risk: Low

## Phase 1: Admin — Liberar restricción

- [ ] 1.1 `app/admin/propiedades/propiedades-client.tsx` — Eliminar `.filter()` en líneas 364-370 que oculta propietarios con parcela activa. Mostrar todos los propietarios activos en el select.
- [ ] 1.2 `app/admin/propiedades/propiedades-client.tsx` — Agregar indicador de parcelas actuales junto al nombre del propietario en el select (ej: "Juan Pérez — Parcela A-101, B-202").

## Phase 2: Componente compartido

- [ ] 2.1 Crear `app/propietario/_components/parcela-selector.tsx` — Componente Client que recibe `parcelas[]`, `selectedId`, `basePath`. Renderiza dropdown, navega con `router.push(\`${basePath}?parcela=${id}\`)`.

## Phase 3: Propietario Dashboard

- [ ] 3.1 `app/propietario/dashboard/page.tsx` — Cambiar `findFirst` por `findMany` para obtener TODAS las parcelas del propietario.
- [ ] 3.2 `app/propietario/dashboard/page.tsx` — Leer `searchParams.parcela`; si no está definido, usar la primera parcela.
- [ ] 3.3 `app/propietario/dashboard/page.tsx` — Pasar parcelas a ParcelaSelector, pasar `selectedParcelaId` a `getPropietarioData()`.
- [ ] 3.4 `app/propietario/dashboard/page.tsx` — Modificar `getPropietarioData()` para aceptar `parcelaId` como parámetro en lugar de leer de `findFirst`.

## Phase 4: Estados de Cuenta

- [ ] 4.1 `app/propietario/estados-cuenta/page.tsx` — `findMany` + `searchParams.parcela` + ParcelaSelector (mismo patrón que dashboard).
- [ ] 4.2 Actualizar texto "Parcela {numero}" para reflejar la parcela seleccionada.

## Phase 5: Informar Pago

- [ ] 5.1 `app/propietario/informar-pago/page.tsx` — `findMany` + `searchParams.parcela` + ParcelaSelector.
- [ ] 5.2 `app/propietario/informar-pago/actions.ts` — Modificar `informarPago()` para recibir `parcelaId` explícito como parámetro del form. Reemplazar `findFirst` por el `parcelaId` recibido.
- [ ] 5.3 `app/propietario/informar-pago/informar-pago-form.tsx` — Agregar hidden input con parcelaId seleccionada.

## Phase 6: Tests

- [ ] 6.1 Test: ParcelaSelector renderiza opciones y navega al cambiar.
- [ ] 6.2 Test: Admin filter muestra todos los propietarios activos (verificar opciones del select).

## Implementation Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1 es independiente (solo admin). Phase 2 es prerequisito para 3-5. Cada página de propietario es independiente entre sí.
