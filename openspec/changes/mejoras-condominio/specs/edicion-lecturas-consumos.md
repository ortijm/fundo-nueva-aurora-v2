# Capacidad: edicion-lecturas-consumos

Edición in-place (AJAX) de `lecturaAnterior` y `lecturaActual` en la gestión de consumos, con recálculo automático y restricción por estado del consumo.

## Requisitos

### Requisito 1: Edición de las dos lecturas
- **Prioridad**: Alta
- **Descripción**: En la gestión de consumos del admin, las celdas `lecturaAnterior` y `lecturaActual` DEBEN ser editables in-place sin recargar la página. SOLO esos dos campos DEBEN ser editables; ningún otro campo del consumo DEBE modificarse desde esta vista.
- **Criterios de aceptación**:
  - La edición DEBE ocurrir en la celda (AJAX), sin navegación.
  - NO DEBE permitirse editar otros campos (tarifa, consumo, montos) desde esta vista.

### Requisito 2: Recálculo al guardar
- **Prioridad**: Alta
- **Descripción**: Al confirmar la edición (Enter o blur), el sistema DEBE recalcular `consumoCalculado = max(0, lecturaActual − lecturaAnterior)` y el monto con la MISMA lógica de `calcularConsumo`, incluyendo la franquicia de agua de la parcela. El resultado DEBE persistirse en la base de datos.
- **Criterios de aceptación**:
  - El consumo calculado NO DEBE ser negativo: si `lecturaAnterior > lecturaActual`, el consumo calculado DEBE ser 0.
  - El monto DEBE recalcularse con la franquicia de la parcela.
  - Los valores recalculados DEBEN guardarse en BD.

### Requisito 3: Confirmación y feedback
- **Prioridad**: Media
- **Descripción**: El guardado DEBE confirmarse con Enter o blur, mostrar un toast "Cambio realizado, datos actualizados" al finalizar, y deshabilitar las celdas mientras el guardado está en curso.
- **Criterios de aceptación**:
  - El toast DEBE mostrarse tras un guardado exitoso.
  - Durante el guardado, las celdas DEBEN estar bloqueadas (sin doble edición).
  - Un error de guardado DEBE mostrarse al usuario y conservar el valor editado para corregirlo.

### Requisito 4: Restricción por estado del consumo
- **Prioridad**: Alta
- **Descripción**: Solo los consumos con estado `PENDIENTE` DEBEN ser editables. Los consumos `CON_ESTADO_CUENTA`, `PAGO_INFORMADO` o `PAGADO` DEBEN mostrar las celdas deshabilitadas con un tooltip que explique que el consumo ya está asociado a un estado de cuenta o pago.
- **Criterios de aceptación**:
  - Consumo `PENDIENTE` → celdas editables.
  - Consumo `CON_ESTADO_CUENTA`, `PAGO_INFORMADO` o `PAGADO` → celdas deshabilitadas y tooltip explicativo.
  - La restricción DEBE validarse también en el servidor, no solo en la UI.

### Requisito 5: Validación server-side
- **Prioridad**: Alta
- **Descripción**: La nueva server action `actualizarLecturaConsumo` DEBE: exigir rol ADMINISTRADOR, validar los valores con zod, usar `withErrorHandling`, rechazar consumos cuyo estado NO sea `PENDIENTE`, invocar `revalidatePath("/admin/consumos")` y actualizar las deudas de la parcela.
- **Criterios de aceptación**:
  - Un usuario sin rol ADMINISTRADOR NO DEBE poder editar lecturas.
  - Valores inválidos (negativos, no numéricos, fuera de rango) DEBEN rechazarse.
  - Un intento de editar un consumo NO `PENDIENTE` DEBE rechazarse en el servidor aunque la UI esté deshabilitada.

### Requisito 6: Recalcular deudas de la parcela
- **Prioridad**: Alta
- **Descripción**: Después de una edición exitosa, las deudas de la parcela DEBEN recalcularse con la lógica existente (`actualizarDeudasParcela`).
- **Criterios de aceptación**:
  - La deuda de la parcela DEBE reflejar el nuevo monto del consumo editado.

## Escenarios

### Escenario 1: Edición válida de una lectura
- **Given** un consumo `PENDIENTE` con lecturaAnterior 100 y lecturaActual 150 en una parcela con franquicia 30 m³
- **When** el admin cambia lecturaActual a 160 y confirma con Enter
- **Then** el consumo calculado es 60 (160 − 100) y el monto usa la franquicia de la parcela (30 m³ exentos → 30 m³ facturados), según `calcularConsumo`
- **And** se muestra el toast "Cambio realizado, datos actualizados"
- **And** la deuda de la parcela refleja el nuevo monto

### Escenario 2: lecturaAnterior mayor que lecturaActual
- **Given** un consumo `PENDIENTE` con lecturaAnterior 200
- **When** el admin guarda lecturaActual 150
- **Then** el consumo calculado es 0 (nunca negativo)
- **And** el guardado persiste sin error

### Escenario 3: Consumo CON_ESTADO_CUENTA
- **Given** un consumo con estado `CON_ESTADO_CUENTA`
- **When** el admin intenta editar sus lecturas
- **Then** las celdas están deshabilitadas con tooltip explicativo
- **And** una petición directa a `actualizarLecturaConsumo` es rechazada

### Escenario 4: Consumo PAGADO
- **Given** un consumo con estado `PAGADO`
- **When** el admin intenta editar sus lecturas
- **Then** las celdas están deshabilitadas con tooltip explicativo
- **And** una petición directa a `actualizarLecturaConsumo` es rechazada

### Escenario 5: Usuario sin permisos
- **Given** un usuario con rol PROPIETARIO
- **When** intenta invocar `actualizarLecturaConsumo`
- **Then** la acción se rechaza por autorización

### Escenario 6: Valores inválidos
- **Given** un consumo `PENDIENTE`
- **When** el admin envía una lectura negativa o no numérica
- **Then** la validación zod rechaza la petición
- **And** no se modifica la base de datos

### Escenario 7: Doble guardado simultáneo
- **Given** un consumo `PENDIENTE` en edición
- **When** el admin dispara dos guardados seguidos
- **Then** el segundo guardado se bloquea mientras el primero está en curso
- **And** la celda queda bloqueada durante el guardado
