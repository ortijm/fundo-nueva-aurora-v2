# Capacidad: franquicia-agua-parcela

Franquicia de agua configurable por parcela (30 m³ / 15 m³) en lugar de un valor global en `ConfiguracionSistema`, y su impacto en el cálculo de consumos y recálculo de estados de cuenta.

## Requisitos

### Requisito 1: Franquicia de agua por parcela
- **Prioridad**: Alta
- **Descripción**: Cada `Parcela` DEBE tener un atributo `franquiciaAgua` con exactamente dos valores fijos posibles: 30 m³ y 15 m³ (el nombre exacto del enum lo define el diseño). Las parcelas nuevas DEBEN asignarse el valor de 30 m³ por defecto.
- **Criterios de aceptación**:
  - El atributo DEBE existir en el modelo `Parcela` y aceptar únicamente los dos valores fijos.
  - Las parcelas nuevas o sin valor explícito DEBEN usar 30 m³.
  - NO DEBE existir un tercer valor de franquicia.

### Requisito 2: Eliminación de la franquicia global
- **Prioridad**: Alta
- **Descripción**: El campo `ConfiguracionSistema.franquiciaAguaM3` DEBE eliminarse del schema, de la UI de configuración y del seed. La franquicia global NO DEBE seguir siendo fuente de verdad para ningún cálculo.
- **Criterios de aceptación**:
  - El campo NO DEBE aparecer en el schema ni en la UI de configuración.
  - El seed NO DEBE asignar `franquiciaAguaM3`.
  - Ningún cálculo DEBE leer la franquicia desde `ConfiguracionSistema`.

### Requisito 3: Cálculo de consumo lee la franquicia de la parcela
- **Prioridad**: Alta
- **Descripción**: `calcularConsumo` DEBE determinar el consumo facturable usando `parcela.franquiciaAgua` en lugar del valor global. Todos los puntos que calculan consumo (importación Excel, `guardarLectura`) DEBEN producir el mismo resultado que `calcularConsumo`.
- **Criterios de aceptación**:
  - El consumo facturable DEBE considerar la franquicia de la parcela (30 m³ o 15 m³).
  - `guardarLectura` DEBE usar la franquicia de la parcela.
  - En flujos masivos, `calcularConsumo` DEBE poder recibir la parcela ya cargada para evitar una consulta adicional por fila; el comportamiento DEBE ser idéntico al de cargar la parcela por su id.

### Requisito 4: Recálculo de estados de cuenta usa la franquicia de la parcela
- **Prioridad**: Alta
- **Descripción**: `generarEstadoCuenta` y `generarECSinNotificacion` DEBEN recalcular subtotales usando la franquicia de la parcela. Los generadores masivos DEBEN heredar este comportamiento al delegar en estas funciones.
- **Criterios de aceptación**:
  - Los EC generados o recalculados DEBEN reflejar la franquicia de la parcela en el subtotal de agua.
  - Los generadores masivos NO DEBEN reintroducir la franquicia global.

### Requisito 5: Cambio de franquicia solo afecta períodos futuros
- **Prioridad**: Alta
- **Descripción**: Cambiar la franquicia de una parcela NO DEBE modificar EC emitidos o pagados en períodos anteriores. Los EC existentes DEBEN conservar sus montos almacenados (invariante snapshot).
- **Criterios de aceptación**:
  - Un cambio de franquicia NO DEBE alterar los montos de EC ya emitidos o pagados.
  - El cambio DEBE afectar únicamente a consumos y EC generados a partir del próximo período.

### Requisito 6: Migración one-time de parcelas existentes
- **Prioridad**: Alta
- **Descripción**: Un script one-time DEBE asignar la franquicia de 30 m³ a las 47 parcelas existentes, de modo que ninguna parcela quede sin franquicia definida.
- **Criterios de aceptación**:
  - Tras ejecutar el script, TODAS las parcelas existentes DEBEN quedar con franquicia 30 m³.
  - El script DEBE ser idempotente: ejecutarlo de nuevo NO DEBE duplicar ni corromper datos.

### Requisito 7: UI de parcelas
- **Prioridad**: Media
- **Descripción**: Los formularios de crear/editar parcela DEBEN ofrecer un select "Franquicia Agua" con las dos opciones, y la tabla de propiedades DEBE mostrar la franquicia de cada parcela (columna o badge), replicando el patrón de `tipoGc`.
- **Criterios de aceptación**:
  - El select DEBE mostrar las opciones 30 m³ y 15 m³.
  - La tabla DEBE mostrar la franquicia de cada parcela.
  - El propietario NO DEBE ver ni editar la franquicia (solo admin).

## Escenarios

### Escenario 1: Parcela con franquicia 15 m³ factura solo el exceso
- **Given** una parcela con `franquiciaAgua` = 15 m³
- **When** se calcula el consumo con lectura 18 m³
- **Then** el consumo facturable es 3 m³ (18 − 15)

### Escenario 2: Parcela con franquicia 30 m³ dentro del límite
- **Given** una parcela con `franquiciaAgua` = 30 m³
- **When** se calcula el consumo con lectura 25 m³
- **Then** el consumo facturable es 0 m³

### Escenario 3: Cambio de franquicia con períodos previos facturados
- **Given** una parcela con EC emitidos en meses anteriores calculados con franquicia 30 m³
- **When** el admin cambia la franquicia a 15 m³
- **Then** los EC emitidos conservan sus montos originales
- **And** los consumos nuevos usan 15 m³

### Escenario 4: Migración one-time sobre las 47 parcelas
- **Given** 47 parcelas existentes sin `franquiciaAgua`
- **When** se ejecuta el script de migración
- **Then** las 47 parcelas quedan con franquicia 30 m³
- **And** una segunda ejecución no produce cambios

### Escenario 5: UI de configuración sin franquicia global
- **Given** un admin en la página de configuración
- **When** carga el formulario
- **Then** el campo de franquicia de agua global NO aparece

### Escenario 6: Generación masiva de EC sin consultas extra por fila
- **Given** un período con varias parcelas y sus datos ya cargados
- **When** se ejecuta la generación masiva de EC
- **Then** cada EC usa la franquicia de su parcela sin consultas adicionales por fila
