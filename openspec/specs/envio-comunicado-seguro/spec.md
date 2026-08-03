# Capacidad: envio-comunicado-seguro

Protección contra envíos duplicados de comunicado, tanto en la UI (estado de carga) como en el servidor (rate-limit/idempotencia).

## Requisitos

### Requisito 1: Estado de envío en la UI
- **Prioridad**: Alta
- **Descripción**: El botón de enviar comunicado DEBE deshabilitarse durante el envío. El estado local `enviando` DEBE setearse ANTES de invocar la server action, y el botón DEBE mostrar el texto "Enviando..." mientras esté activo.
- **Criterios de aceptación**:
  - `enviando` DEBE setearse antes del `await` de la server action.
  - El botón DEBE tener `disabled` durante el envío.
  - El botón DEBE mostrar "Enviando..." mientras dure el envío.
  - Tras finalizar, el botón DEBE volver a su estado normal.

### Requisito 2: Resultado del envío
- **Prioridad**: Media
- **Descripción**: Al terminar el envío, el sistema DEBE mostrar un toast con el resultado: éxito (con destinatarios alcanzados) o errores (resumen de fallos, p. ej. destinatarios sin email).
- **Criterios de aceptación**:
  - Un envío exitoso DEBE mostrar un toast de éxito.
  - Un envío con errores parciales DEBE mostrar un toast que resuma los errores.

### Requisito 3: Rate-limit en el servidor
- **Prioridad**: Alta
- **Descripción**: La server action `enviarComunicadoAction` DEBE aplicar el mecanismo de `lib/ratelimit.ts` con acción `enviar-comunicado`, limitando a 5 intentos por ventana de 15 minutos por usuario, igual que el flujo de forgot-password.
- **Criterios de aceptación**:
  - Superar 5 intentos de envío en 15 minutos DEBE rechazar la acción con un error de rate-limit.
  - El identifier DEBE incluir al usuario, de modo que el límite sea por usuario.

### Requisito 4: Aislamiento del rate-limit
- **Prioridad**: Alta
- **Descripción**: El rate-limit de `enviar-comunicado` NO DEBE afectar otras acciones que usen el mismo mecanismo (p. ej. forgot-password). Cada acción DEBE contar intentos por separado.
- **Criterios de aceptación**:
  - Agotar el límite de `enviar-comunicado` NO DEBE bloquear forgot-password ni otras acciones.
  - La clave de rate-limit DEBE combinar acción e identifier.

### Requisito 5: Sin envíos duplicados
- **Prioridad**: Alta
- **Descripción**: El doble clic o los reintentos NO DEBEN producir envíos duplicados. La combinación de bloqueo en UI y rate-limit en servidor DEBE garantizar que una misma intención de envío genere un único envío.
- **Criterios de aceptación**:
  - Un doble clic en "Enviar" DEBE producir un único envío.
  - Los reintentos dentro de la ventana DEBEN rechazarse o no duplicar destinatarios.

## Escenarios

### Escenario 1: Doble clic en el botón de enviar
- **Given** el formulario de comunicado listo para enviarse
- **When** el admin hace doble clic en "Enviar"
- **Then** el segundo clic no dispara nada (botón deshabilitado con "Enviando...")
- **And** se produce UN solo envío de correos

### Escenario 2: Botón durante el envío
- **Given** un envío en curso
- **When** el admin observa el botón
- **Then** el botón está deshabilitado y muestra "Enviando..."

### Escenario 3: Límite de intentos superado
- **Given** 5 envíos de comunicado realizados en los últimos 15 minutos por el mismo admin
- **When** el admin intenta enviar de nuevo
- **Then** la acción se rechaza con error de rate-limit
- **And** no se envían correos

### Escenario 4: El rate-limit no afecta otras acciones
- **Given** el límite de `enviar-comunicado` agotado para un admin
- **When** el mismo admin usa forgot-password (acción distinta)
- **Then** la acción de forgot-password NO se ve afectada por el límite del comunicado

### Escenario 5: Envío con errores parciales
- **Given** un envío donde un destinatario no tiene email
- **When** el envío termina
- **Then** el toast resume el resultado mostrando el error parcial
- **And** los destinatarios válidos sí recibieron el comunicado

### Escenario 6: Envío exitoso
- **Given** todos los destinatarios con email válido
- **When** el envío termina correctamente
- **Then** se muestra un toast de éxito con el resultado
- **And** el botón vuelve a su estado normal
