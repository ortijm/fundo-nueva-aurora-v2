# Proposal: Gasto Común configurable por parcela

## Intent

Permitir que el administrador seleccione si una parcela paga GC normal ($25.000) o reducido ($15.000) directamente desde la ficha de la parcela, reemplazando la lógica actual que decide el monto según si la parcela tiene o no historial de consumo.

## Problem

La lógica actual en `generarGastosComunes()` es binaria:

```typescript
const tieneHistorial = await prisma.consumoMensual.count({
  where: { parcelaId: parcela.id, tipoConsumoId: { not: tipoGc.id } },
});
const monto = tieneHistorial > 0
  ? config.montoGcConHistorial   // $25.000
  : config.montoGcNuevo;         // $15.000
```

Esto no contempla parcelas que, teniendo medidor y consumo registrado, deberían pagar la tarifa reducida ($15.000) por ser de consumo mínimo, nuevos propietarios, etc.

## Scope

### In Scope
- Nuevo campo `tipoGc` (NORMAL / REDUCIDO) en el modelo Parcela
- Modificar `generarGastosComunes()` para leer `parcela.tipoGc` en vez de contar historial
- Agregar control de tipo GC en el formulario de crear/editar parcela (Admin → Propiedades)
- Mostrar columna "GC" en la tabla de propiedades
- Mantener backward compatibility: parcelas existentes se migran según su historial actual
- Tests unitarios de la lógica

### Out of Scope
- Cambios en la UI del propietario (no necesita ver esto)
- Nuevas pantallas o rutas
- Cambios en el esquema de precios global (montoGcNuevo y montoGcConHistorial siguen en Configuración)
- Migraciones SQL formales (el proyecto usa `prisma db push`)

## Approach

1. Schema: agregar `tipoGc TipoGastoComun @default(NORMAL)` a Parcela
2. Server action: `generarGastosComunes()` reemplaza el count de historial por `parcela.tipoGc`
3. Admin UI: select simple en el modal de parcela (NORMAL = $25.000, REDUCIDO = $15.000) + columna en tabla
4. Migración: script one-time que asigna REDUCIDO a parcelas sin historial, NORMAL a las demás
5. Tests: replican la lógica pura de decisión de monto según tipoGc

## Risks

- Bajo: no hay cambio en la generación de GC si todas las parcelas quedan como NORMAL
- Medio: si la migración one-time no se ejecuta, parcelas nuevas sin historial quedarían como NORMAL ($25.000)
