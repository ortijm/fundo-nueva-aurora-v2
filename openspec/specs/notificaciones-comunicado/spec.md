# Capacidad: notificaciones-comunicado

Destinatarios selectivos del comunicado (todos los propietarios / solo morosos / parcelas específicas) y trazabilidad por parcela en `Notificacion`.

## Requisitos

### Requisito 1: Selector de destinatarios con tres opciones
- **Prioridad**: Alta
- **Descripción**: El formulario de envío de comunicado DEBE ofrecer exactamente tres opciones de destinatarios: "Todos los propietarios", "Solo morosos" y "Seleccionar parcelas…". Al elegir la tercera opción, DEBE mostrarse un multi-select de parcelas activas con su propietario.
- **Criterios de aceptación**:
  - Las tres opciones DEBEN ser visibles y seleccionables.
  - El multi-select DEBE listar solo parcelas activas y solo aquellas con propietario asignado.
  - El envío con la opción (c) sin parcelas seleccionadas NO DEBE proceder; DEBE mostrarse un error.

### Requisito 2: Resolución de destinatarios "Todos los propietarios"
- **Prioridad**: Alta
- **Descripción**: Con la opción (a), el comunicado DEBE enviarse a todos los propietarios activos de parcelas activas, replicando el comportamiento actual.
- **Criterios de aceptación**:
  - Cada propietario activo con al menos una parcela activa DEBE recibir el comunicado.
  - El envío NO DEBE duplicar destinatarios.

### Requisito 3: Resolución de destinatarios "Solo morosos"
- **Prioridad**: Alta
- **Descripción**: Con la opción (b), se consideran morosas las parcelas con `deudaTotal > 0` O con un `estado_cuenta` en estado `EMITIDO` sin pagar en el período actual. Los destinatarios DEBEN ser los propietarios de esas parcelas, sin duplicados cuando un propietario tiene varias parcelas morosas.
- **Criterios de aceptación**:
  - Una parcela DEBE incluirse como morosa si cumple cualquiera de las dos condiciones.
  - Un propietario con varias parcelas morosas DEBE recibir UNA sola notificación (dedupe).
  - Parcelas sin propietario asignado DEBEN omitirse.
  - Si no hay morosos, el envío NO DEBE crear notificaciones y DEBE informar el resultado.

### Requisito 4: Resolución de destinatarios "Seleccionar parcelas…"
- **Prioridad**: Alta
- **Descripción**: Con la opción (c), el comunicado DEBE enviarse únicamente a los propietarios de las parcelas seleccionadas, con dedupe si el mismo propietario posee varias parcelas seleccionadas.
- **Criterios de aceptación**:
  - Solo los propietarios de las parcelas seleccionadas DEBEN recibir el comunicado.
  - El dedupe DEBE aplicarse también en esta opción.

### Requisito 5: Query única y testeable
- **Prioridad**: Media
- **Descripción**: La resolución de destinatarios para las tres opciones DEBE implementarse con una query única y testeable sobre la base de datos, sin bucles de consulta por parcela.
- **Criterios de aceptación**:
  - La resolución DEBE ejecutar una cantidad constante de queries, independiente del número de parcelas.
  - La lógica DEBE ser invocable de forma aislada para pruebas unitarias.

### Requisito 6: Trazabilidad por parcela
- **Prioridad**: Media
- **Descripción**: Cuando el envío usa las opciones (b) o (c), cada `Notificacion` DEBE registrar la parcela que originó el envío en `parcelaId`. Con la opción (a), `parcelaId` PUEDE quedar vacío.
- **Criterios de aceptación**:
  - Las notificaciones de envíos (b) y (c) DEBEN tener `parcelaId` poblado.
  - El campo `parcelaId` NO DEBE usarse como filtro de destinatarios (ya existe en el modelo).

### Requisito 7: Usuarios sin email no abortan el envío
- **Prioridad**: Alta
- **Descripción**: Si un destinatario no tiene email registrado, su notificación DEBE quedar en estado ERROR con detalle "Sin email registrado" y el envío DEBE continuar con el resto de destinatarios.
- **Criterios de aceptación**:
  - Un destinatario sin email DEBE generar una notificación con estado ERROR y `errorDetalle` = "Sin email registrado".
  - El fallo de un destinatario NO DEBE abortar el envío de los demás.
  - El resultado del envío DEBE reportar los destinatarios con error.

## Escenarios

### Escenario 1: Envío a todos los propietarios
- **Given** 5 propietarios activos con parcelas activas
- **When** el admin envía el comunicado con la opción "Todos los propietarios"
- **Then** se crean 5 notificaciones, una por propietario, sin duplicados

### Escenario 2: Moroso por deudaTotal
- **Given** una parcela con `deudaTotal > 0` y su propietario
- **When** el admin envía con la opción "Solo morosos"
- **Then** el propietario recibe el comunicado

### Escenario 3: Moroso por EC emitido sin pagar
- **Given** una parcela con `deudaTotal = 0` pero un EC `EMITIDO` sin pago en el período actual
- **When** el admin envía con la opción "Solo morosos"
- **Then** la parcela se considera morosa y su propietario recibe el comunicado

### Escenario 4: Propietario multi-parcela con varias parcelas morosas
- **Given** un propietario con 2 parcelas morosas y otro propietario con 1 parcela morosa
- **When** el admin envía con la opción "Solo morosos"
- **Then** el propietario multi-parcela recibe UNA notificación
- **And** el otro propietario recibe una notificación

### Escenario 5: Selección manual de parcelas
- **Given** parcelas P1, P2 y P3 activas con propietarios A, B y C
- **When** el admin selecciona solo P1 y P3 y envía
- **Then** solo A y C reciben el comunicado
- **And** B no recibe notificación

### Escenario 6: Usuario sin email
- **Given** 3 destinatarios, uno de ellos sin email registrado
- **When** el admin envía el comunicado
- **Then** la notificación del usuario sin email queda en ERROR con "Sin email registrado"
- **And** los otros 2 destinatarios reciben el comunicado normalmente
- **And** el resultado reporta el error parcial

### Escenario 7: Trazabilidad en envío por parcela
- **Given** un envío con la opción "Seleccionar parcelas…" sobre la parcela P2
- **When** se crean las notificaciones
- **Then** cada notificación tiene `parcelaId` = P2

### Escenario 8: Parcela activa sin propietario
- **Given** una parcela activa sin propietario asignado
- **When** el admin abre el multi-select de parcelas
- **Then** la parcela no aparece en la lista
- **And** no se generan notificaciones para ella en ninguna opción
