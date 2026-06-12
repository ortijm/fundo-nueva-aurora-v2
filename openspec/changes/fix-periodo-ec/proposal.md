# Proposal: Fix EC Billing Period Display

## Intent

Los registros de EstadoCuenta (EC) usan el período de corte (mes de carga de lecturas) como período de facturación, pero el consumo corresponde al mes anterior. Ejemplo: lecturas con corte "06-2026" representan consumo de mayo, pero el EC muestra "Junio 2026". Esto genera confusión en propietarios y problemas de conciliación contable.

## Scope

### In Scope
- Función helper centralizada para desplazar período -1 mes
- Actualización de etiquetas en PDFs de EC
- Actualización de etiquetas en notificaciones por email
- Actualización de asunto de notificaciones admin
- Actualización de UI propietario (listado y dashboard)
- Corrección retroactiva automática de ECs antiguos

### Out of Scope
- Migración de datos en base de datos (el campo `periodo` se mantiene como corte)
- Reenvío de emails/PDFs ya enviados (histórico, no modificable)
- Cambios en la lógica de generación de EC ni en la tabla `EstadoCuenta`

## Approach: Label-Only Fix (Option A)

No se modifica qué se almacena en DB. Se cambia únicamente la visualización para mostrar `periodo - 1 mes` en todos los puntos de renderizado.

**Dado** que un EC tiene periodo 2026-06 (corte junio),
**cuando** se renderiza en PDF, email o UI,
**entonces** se muestra "Mayo 2026" en lugar de "Junio 2026".

**Dado** que existen ECs antiguos con etiquetas incorrectas,
**cuando** se visualicen después del cambio,
**entonces** mostrarán retroactivamente el período correcto sin necesidad de migración.

### Función Helper

```ts
function getPeriodoDisplay(periodo: string): string {
  // "2026-06" → "Mayo 2026"
  // Decrementa el mes en 1, ajustando año si es enero
}
```

## Affected Areas

| Area | Impact | Descripción |
|------|--------|-------------|
| `app/api/ec/[id]/pdf/route.ts` | Modified | `periodoLabel` usa helper para -1 mes |
| `lib/services/email.ts` | Modified | `enviarNotificacionEstadoCuenta` desplaza período |
| `app/admin/estados-cuenta/actions.ts` | Modified | Asunto de notificación desplazado |
| `app/propietario/estados-cuenta/page.tsx` | Modified | `formatPeriodo` usa helper |
| `app/propietario/dashboard/page.tsx` | Modified | `formatPeriodo` usa helper |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Emails/PDFs ya enviados conservan etiquetas viejas | Alta | Aceptar como histórico; no se puede corregir |
| Helper centralizado falla para meses límite (enero) | Baja | Tests unitarios para edge cases: enero → diciembre año anterior |
| Confusión temporal al mostrar "Mayo" en junio | Media | Documentar en la UI que el período corresponde al consumo, no al corte |

## UX: Leyenda en filtro de EC

En la página de Estados de Cuenta (admin), agregar una leyenda debajo del filtro de período para que cualquier usuario entienda la relación:

```
Período de corte: [2026-06 ▼]
💡 Al seleccionar un período, se muestran los EC del mes anterior.
   Ej: Junio 2026 → ECs de Mayo 2026
```

Esto evita confusión ya que el filtro muestra el período de corte (cuando se subieron las lecturas) y los resultados muestran el período de facturación (el mes que se cobra).

## Rollback

1. Revertir commits del cambio
2. Las etiquetas vuelven a mostrar el período de corte original
3. Sin migración DB = sin riesgo de pérdida de datos
4. Los emails/PDFs nuevos volverán a usar el período de corte

## Success Criteria

- [ ] Todas las vistas muestran el período de consumo (corte - 1)
- [ ] La función helper cubre edge cases de mes 1 → mes 12 año anterior
- [ ] PDFs generados reflejan el período correcto
- [ ] Notificaciones email muestran el período correcto
- [ ] UI propietario (listado y dashboard) muestra el período correcto
- [ ] Tests unitarios validan el helper para todos los meses
