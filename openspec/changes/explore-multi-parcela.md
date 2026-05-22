# Exploration: Multi-Parcela Support

**Change**: multi-parcela
**Date**: 2026-05-22

## Current State

### Schema (already supports multi-parcela)
- `Parcela.propietarioId` is nullable String with NO unique constraint
- `Usuario.parcelas` is `Parcela[]` → already one-to-many at DB level
- All related models (ConsumoMensual, EstadoCuenta, Pago) reference `parcelaId` directly
- No migrations needed

### Admin UI — Bloqueo real
En `app/admin/propiedades/propiedades-client.tsx` líneas 364-370, el select de propietarios filtra:
```tsx
.filter(u => {
  if (!u.isActive) return false;
  const tieneActiva = u.parcelas.some(p => p.estado === "ACTIVA");
  if (!tieneActiva) return true;
  return editandoParcela?.propietarioId === u.id;  // Oculta propietarios con parcela activa
})
```
Esta línea es la ÚNICA razón por la que no se puede asignar el mismo propietario a 2 parcelas.

### Propietario UI — Solo ve 1 parcela
- `findFirst` en dashboard, estados-cuenta, informar-pago → siempre devuelve la primera parcela
- La UI asume que el propietario tiene UNA parcela

### Email Notifications
- `enviarNotificacionEstadoCuenta(ecId)` envía 1 email por EC → escalable a multi-parcela

## Affected Areas

| Archivo | Cambio Necesario |
|---------|-----------------|
| `app/admin/propiedades/propiedades-client.tsx` | Eliminar/relajar el filtro de propietarios en select |
| `app/propietario/dashboard/page.tsx` | Agregar selector de parcela, cargar data por parcela seleccionada |
| `app/propietario/estados-cuenta/page.tsx` | Mostrar ECs por parcela o con selector |
| `app/propietario/informar-pago/page.tsx` | Permitir seleccionar qué parcela pagar |
| `app/propietario/informar-pago/actions.ts` | Usar parcelaId seleccionada en lugar de findFirst |
| `app/admin/estados-cuenta/actions.ts` | `generarEstadoCuenta` ya funciona por parcela |
| `lib/services/email.ts` | Ya funciona por EC individual |
| `app/api/ec/[id]/pdf/route.ts` | Validación de propiedad OK |

## Recommended Approach: Enfoque A — Selector de Parcela

El propietario elige qué parcela ver en un selector tipo tabs/dropdown.

### Admin
1. Eliminar filtro de propietarios en propiedades-client.tsx
2. Mostrar todos los propietarios activos disponibles en el select

### Propietario UI
1. **Dashboard**: Selector de parcela en la cabecera, carga data de la parcela seleccionada
2. **Estados de Cuenta**: Selector + ECs de la parcela seleccionada
3. **Informar Pago**: Selector + cargar consumos pendientes de la parcela seleccionada

### Notificaciones
1 email por EC emitido, con asunto que identifica claramente la parcela.
