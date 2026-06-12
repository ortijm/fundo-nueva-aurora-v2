# Spec: Fix EC Billing Period Display

## Resumen

Los registros de EstadoCuenta (EC) almacenan el período de corte (mes de carga de lecturas) en el campo `periodo`. El consumo corresponde al mes anterior. Actualmente se muestra el período de corte como período de facturación, generando confusión. Este cambio desplaza la visualización -1 mes en todos los puntos de renderizado.

---

## Requisitos

### R1: Helper centralizado `getPeriodoBilling`

La función `getPeriodoBilling(periodo: Date): Date` DEBE restar 1 mes al período dado, ajustando el año cuando el mes es enero (enero → diciembre del año anterior).

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 1.1 | `periodo = 2026-06-01` (junio) | Se llama `getPeriodoBilling(periodo)` | Retorna `2026-05-01` (mayo) |
| 1.2 | `periodo = 2026-01-01` (enero) | Se llama `getPeriodoBilling(periodo)` | Retorna `2025-12-01` (diciembre del año anterior) |
| 1.3 | `periodo = 2025-03-01` (marzo) | Se llama `getPeriodoBilling(periodo)` | Retorna `2025-02-01` (febrero) |
| 1.4 | `periodo = 2025-12-01` (diciembre) | Se llama `getPeriodoBilling(periodo)` | Retorna `2025-11-01` (noviembre) |

### R2: PDF — Etiqueta del período principal

El PDF de estado de cuenta DEBE mostrar el período de facturación (periodo - 1 mes) en el encabezado y título del documento. La etiqueta DEBE usar el formato "Mes Año" en español (ej: "Mayo 2026").

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 2.1 | EC con periodo `2026-06-01` | Se genera el PDF | El título muestra "Mayo 2026" |
| 2.2 | EC con periodo `2026-01-01` | Se genera el PDF | El título muestra "Diciembre 2025" |
| 2.3 | EC con periodo `2026-06-01` | Se genera el PDF | El nombre del archivo contiene el período de facturación |

### R3: PDF — Filas de detalle de consumo (fmtPeriodoCorto)

Las filas de la tabla de detalle de consumo en el PDF DEBEN usar `getPeriodoBilling` antes de formatear con `fmtPeriodoCorto`. Cada consumo individual muestra su propio `item.periodo`, y este DEBE desplazarse -1 mes para reflejar el período de facturación real.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 3.1 | Consumo con periodo `2026-06-01` en tabla variable | Se renderiza la fila | Muestra "May 2026" (formato corto) |
| 3.2 | Consumo con periodo `2026-01-01` en tabla variable | Se renderiza la fila | Muestra "Dic 2025" |
| 3.3 | Consumo con periodo `2026-06-01` en tabla fija | Se renderiza la fila | Muestra "May 2026" |

### R4: Email — Período en asunto y cuerpo

El email de notificación de EC DEBE usar el período de facturación (periodo - 1 mes) tanto en el asunto del correo como en el cuerpo del mensaje.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 4.1 | EC con periodo `2026-06-01` | Se envía email | El asunto contiene "Mayo 2026" |
| 4.2 | EC con periodo `2026-06-01` | Se envía email | El cuerpo menciona "período Mayo 2026" |
| 4.3 | EC con periodo `2026-01-01` | Se envía email | El asunto contiene "Diciembre 2025" |

### R5: Notificación admin — Asunto desplazado

La notificación creada en `generarEstadoCuenta` DEBE usar el período de facturación (periodo - 1 mes) en el campo `asunto`.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 5.1 | EC con periodo `2026-06-01` | Se genera EC con notificación | El asunto de la notificación es "Estado de Cuenta Mayo 2026 — Parcela X" |
| 5.2 | EC con periodo `2026-01-01` | Se genera EC con notificación | El asunto contiene "Diciembre 2025" |

### R6: UI propietario — Listado de estados de cuenta

La página de estados de cuenta del propietario DEBE mostrar el período de facturación (periodo - 1 mes) en cada item del listado.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 6.1 | EC con periodo `2026-06-01` | Se renderiza el listado | Muestra "mayo 2026" (formato largo) |
| 6.2 | EC con periodo `2026-01-01` | Se renderiza el listado | Muestra "diciembre 2025" |

### R7: UI propietario — Dashboard

El dashboard del propietario DEBE mostrar el período de facturación (periodo - 1 mes) en la tabla de "Historial de Últimos Cobros".

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 7.1 | EC con periodo `2026-06-01` | Se renderiza dashboard | La columna "Mes Período" muestra "mayo 2026" |
| 7.2 | EC con periodo `2026-01-01` | Se renderiza dashboard | La columna muestra "diciembre 2025" |

### R8: Admin — Leyenda en filtro de período

La página admin de estados de cuenta DEBE mostrar un texto explicativo debajo del selector de período que indique la relación entre período de corte y período de facturación.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 8.1 | Admin abre la página de EC | Se carga el filtro de período | Se muestra leyenda: "Al seleccionar un período, se muestran los EC del mes anterior. Ej: Junio 2026 → ECs de Mayo 2026" |
| 8.2 | Admin selecciona período `2026-01` | Se actualiza la leyenda | La leyenda se adapta: "Enero 2026 → ECs de Diciembre 2025" |

### R9: Inmutabilidad de datos en DB

El campo `periodo` en la tabla `EstadoCuenta` NO DEBE ser modificado. El cambio es puramente de visualización. No DEBE existir migración de datos.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 9.1 | EC con periodo `2026-06-01` en DB | Se aplica el cambio | El valor en DB sigue siendo `2026-06-01` |
| 9.2 | Se ejecuta el deploy | Se verifica la DB | No hay migraciones SQL que modifiquen la tabla `EstadoCuenta` |

### R10: UI propietario — Informar pago (consumos pendientes)

La página de informar pago del propietario DEBE mostrar el período de facturación (periodo - 1 mes) en cada consumo pendiente listado para un EC.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 10.1 | Consumo con periodo `2026-06-01` | Se lista en informar pago | Muestra "luz — mayo 2026" |
| 10.2 | Consumo con periodo `2026-01-01` | Se lista en informar pago | Muestra "agua — diciembre 2025" |

### R11: UI admin — Informar pago (consumos del EC)

La página admin de informar pago DEBE mostrar el período de facturación (periodo - 1 mes) en cada consumo listado para un EC.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 11.1 | Consumo con periodo `2026-06-01` | Se lista en admin informar pago | Muestra "luz — mayo 2026" |
| 11.2 | Consumo con periodo `2026-01-01` | Se lista en admin informar pago | Muestra "agua — diciembre 2025" |

### R12: UI admin — Validación de pagos (consumos cubiertos)

La página admin de validación DEBE mostrar el período de facturación (periodo - 1 mes) en los consumos cubiertos por un pago seleccionado.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 12.1 | Consumo con periodo `2026-06-01` | Se muestra en validación | Muestra "luz — mayo 2026" |
| 12.2 | Consumo con periodo `2026-01-01` | Se muestra en validación | Muestra "agua — diciembre 2025" |

### R13: Dashboard propietario — Labels del gráfico

Los labels del eje X del gráfico de consumo del dashboard del propietario DEBEN usar el período de facturación (periodo - 1 mes).

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 13.1 | Consumo con periodo `2026-06-01` | Se renderiza el gráfico | El label del eje X muestra "May 2026" (formato corto) |
| 13.2 | Consumo con periodo `2026-01-01` | Se renderiza el gráfico | El label del eje X muestra "Dic 2025" |

### R14: Rollback

El cambio DEBE ser revertible eliminando únicamente los commits correspondientes, sin necesidad de migración inversa.

**Escenarios:**

| # | Dado | Cuando | Entonces |
|---|------|--------|----------|
| 10.1 | Cambio desplegado | Se revierten los commits | Las etiquetas vuelven a mostrar el período de corte original |

---

## Fuera de alcance

- Migración de datos en base de datos (el campo `periodo` se mantiene como corte)
- Reenvío de emails/PDFs ya enviados (histórico, no modificable)
- Cambios en la lógica de generación de EC ni en la tabla `EstadoCuenta`
- **Gastos Comunes (GC):** El campo `GastoComun.periodo` SÍ representa el período de facturación real (mes que se está cobrando). No necesita desplazamiento. `gastos-client.tsx` línea 60 ya es correcta.

---

## Criterios de éxito

- [ ] Todas las vistas muestran el período de consumo (corte - 1)
- [ ] La función helper cubre edge cases de mes 1 → mes 12 año anterior
- [ ] PDFs generados reflejan el período correcto en encabezado y detalle
- [ ] Notificaciones email muestran el período correcto
- [ ] UI propietario (listado, dashboard, informar-pago) muestra el período correcto
- [ ] UI admin (informar-pago, validación) muestra el período correcto
- [ ] Admin tiene leyenda que explica la relación corte → facturación
- [ ] Gráfico del dashboard usa labels con período de facturación
- [ ] Tests unitarios validan el helper para todos los meses
- [ ] Gastos Comunes NO son afectados (periodo = facturación, correcto)
