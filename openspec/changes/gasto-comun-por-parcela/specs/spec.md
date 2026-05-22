# Spec: Gasto Común configurable por parcela

## Functional Requirements

### FR1: Campo tipoGc en parcela
Cada parcela tiene un atributo `tipoGc` que determina qué monto de gasto común se le aplica:

| Valor | Significado | Monto |
|-------|-------------|-------|
| `NORMAL` | GC estándar | `config.montoGcConHistorial` ($25.000) |
| `REDUCIDO` | GC rebajado | `config.montoGcNuevo` ($15.000) |

**Default**: `NORMAL`

### FR2: Generación de GC usa tipoGc
La función `generarGastosComunes()` debe usar `parcela.tipoGc` para determinar el monto, reemplazando la lógica actual de conteo de historial.

### FR3: Admin puede cambiar tipoGc desde Propiedades
- En el modal de **crear/editar parcela**, un select permite elegir entre NORMAL y REDUCIDO
- En la **tabla de propiedades**, una columna muestra el tipo GC de cada parcela

### FR4: Migración de parcelas existentes
Asignación inicial automática:
- Parcelas con historial de consumo (agua/luz) → `NORMAL`
- Parcelas sin historial de consumo → `REDUCIDO`
- La migración se ejecuta una sola vez como script

## Scenarios

### S1: Admin crea parcela nueva
1. Admin va a **Propiedades → Nueva Unidad**
2. Completa número, propietario, etc.
3. En el campo "Gasto Común", selecciona `NORMAL ($25.000)` o `REDUCIDO ($15.000)`
4. Guarda → parcela creada con `tipoGc` asignado

### S2: Admin edita parcela existente
1. Admin edita parcela
2. Cambia "Gasto Común" de NORMAL a REDUCIDO
3. Guarda → al próximo "Generar Gastos", la parcela usa el nuevo monto

### S3: Generar GC respeta tipoGc
1. Admin hace clic en "Generar Gastos" para un período
2. Parcelas con `tipoGc = NORMAL` → $25.000
3. Parcelas con `tipoGc = REDUCIDO` → $15.000
4. No se cuenta historial de consumo

### S4: Migración one-time
1. Se ejecuta script que recorre parcelas activas
2. Si parcela tiene `ConsumoMensual` (excluyendo tipo GC) → `NORMAL`
3. Si no tiene → `REDUCIDO`
4. Cambio inmediato para el próximo GC generado

### S5: Sin cambios en UI de propietario
El propietario no ve ni interactúa con `tipoGc`. Solo ve el monto final en su estado de cuenta.

## Non-functional Requirements

- NFR1: No romper GC ya generados en períodos anteriores (son datos históricos)
- NFR2: Backward compatible — si no se ejecuta migración, parcelas arrancan como NORMAL ($25.000)
