# Proposal: Multi-Parcela Support

**Change**: multi-parcela
**Status**: Proposal
**Date**: 2026-05-22

## Intent

Permitir que un propietario (Usuario con rol PROPIETARIO) pueda tener MÚLTIPLES parcelas asignadas a su nombre, y que desde su sesión pueda visualizar y gestionar cada una de ellas individualmente.

## Scope

### In Scope
1. **Admin UI — Propiedades**: Eliminar la restricción que impide asignar un propietario a más de una parcela
2. **Propietario — Dashboard**: Agregar selector de parcela; mostrar data de la parcela seleccionada
3. **Propietario — Estados de Cuenta**: Agregar selector de parcela; mostrar ECs de la parcela seleccionada
4. **Propietario — Informar Pago**: Permitir seleccionar qué parcela pagar
5. **Notificaciones de EC**: Al generar ECs para múltiples parcelas del mismo propietario, enviar emails separados por parcela (ya funciona así, no requiere cambios)

### Out of Scope
- Vista consolidada de deudas multi-parcela (futura mejora)
- Pago consolidado multi-parcela (un solo pago para varias parcelas)
- Reportes administrativos multi-propietario

## Approach

### Enfoque A: Selector de Parcela

El propietario ve un selector (dropdown/tabs) en la cabecera de las secciones de propietario. Al cambiar de parcela, toda la data se recarga para esa parcela.

**Por qué este enfoque:**
- Mínimo cambio en el schema (cero migraciones)
- Cada parcela mantiene su identidad y deudas separadas
- Bajo riesgo de regression — los queries existentes ya filtran por parcelaId
- Fácil de implementar y entender para el usuario

## Affected Areas

### 1. Admin UI
**`app/admin/propiedades/propiedades-client.tsx`** (líneas 364-370)
- Eliminar el `.filter()` que oculta propietarios con parcela activa
- Mostrar todos los propietarios activos en el select
- Agregar indicador visual de cuántas parcelas tiene cada propietario

### 2. Propietario Dashboard
**`app/propietario/dashboard/page.tsx`**
- Cambiar `findFirst` → consultar TODAS las parcelas del propietario
- Agregar selector de parcela en el header
- `getPropietarioData()` recibe `parcelaId` como parámetro
- Navegación: `/propietario/dashboard?parcela=X` o usar estado en server component

### 3. Propietario Estados de Cuenta
**`app/propietario/estados-cuenta/page.tsx`**
- Consultar todas las parcelas del propietario
- Selector de parcela
- Cargar ECs de la parcela seleccionada

### 4. Propietario Informar Pago
**`app/propietario/informar-pago/page.tsx`**
- Selector de parcela
- Cargar consumos pendientes de la parcela seleccionada
- Pasar parcelaId a InformarPagoForm

**`app/propietario/informar-pago/actions.ts`**
- Recibir parcelaId explícito en lugar de usar `findFirst`

### 5. EC / Notificaciones
**`app/admin/estados-cuenta/actions.ts`**
- `generarEstadoCuenta()` ya funciona por parcela → sin cambios
- `enviarNotificacionEstadoCuenta()` ya envía 1 email por EC → sin cambios

**`app/api/ec/[id]/pdf/route.ts`**
- La validación `ec.parcela.propietarioId !== session.user.id` ya funciona

### 6. Schema
**`prisma/schema.prisma`** — Sin cambios

## Implementation Plan

### Fase 1: Admin — Liberar restricción
1. Modificar `propiedades-client.tsx` para mostrar todos los propietarios activos

### Fase 2: Propietario — Selector de parcela
1. Crear componente `ParcelaSelector` reutilizable (dropdown con parcelas del propietario)
2. Modificar dashboard para usar selector
3. Modificar estados-cuenta para usar selector
4. Modificar informar-pago para usar selector

### Fase 3: Informar Pago — Multi-parcela
1. Modificar actions.ts para aceptar parcelaId explícito
2. Actualizar form para enviar parcelaId

## Rollback Plan

1. **Admin**: Restaurar el `.filter()` en propiedades-client.tsx
2. **Propietario UI**: Revertir a `findFirst` en cada página
3. **Actions**: Volver a usar `findFirst` en informar-pago

Cada cambio es atómico y reversible.

## Risks

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Propietario se confunde con múltiples parcelas | Medio | Selector claro, etiquetas visibles con número de parcela |
| Pagos aplicados a parcela incorrecta | Medio | Mostrar parcela seleccionada en todo el flujo de pago |
| Regression en propietarios con 1 parcela | Bajo | El selector muestra 1 opción, comportamiento idéntico |

## Ready for Next Phase

Yes — proceed to sdd-spec for detailed specification and scenarios.
