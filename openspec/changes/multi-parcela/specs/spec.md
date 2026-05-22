# Multi-Parcela Specification

**Change**: multi-parcela
**Type**: Full spec (new capability)
**Date**: 2026-05-22

## Purpose

Allow a single propietario to own and manage multiple parcelas through the system.

## Requirements

### R1: Admin — Asignación de propietario a parcela

The admin parcela form MUST show ALL active propietarios in the owner selector, regardless of whether they already own other parcelas.

The system SHOULD indicate how many parcelas each propietario currently has.

#### Scenario: Asignar mismo propietario a segunda parcela

- GIVEN a propietario activo que ya tiene una parcela asignada
- WHEN el administrador crea o edita una parcela y abre el selector de propietario
- THEN el propietario aparece en la lista
- AND puede ser seleccionado y guardado exitosamente

### R2: Propietario — Selección de parcela

The propietario sections (dashboard, estados de cuenta, informar pago) MUST provide a way to select which parcela to view.

If the propietario has only one parcela, the selector SHOULD be hidden and behavior MUST remain identical to the current single-parcela experience.

#### Scenario: Propietario con múltiples parcelas cambia de parcela

- GIVEN un propietario con 2+ parcelas activas
- WHEN selecciona una parcela del selector
- THEN la interfaz muestra los datos (deudas, consumos, ECs, pagos) correspondientes a ESA parcela

#### Scenario: Propietario con una sola parcela

- GIVEN un propietario con exactamente 1 parcela activa
- WHEN accede al dashboard o estados de cuenta
- THEN ve su información SIN selector visible
- AND el comportamiento es idéntico al actual

### R3: Propietario — Dashboard multi-parcela

The dashboard MUST load deudas, consumos, gráficos, pagos, y estados de cuenta for the SELECTED parcela.

#### Scenario: Dashboard muestra datos de parcela seleccionada

- GIVEN un propietario con parcela A seleccionada en el dashboard
- WHEN cambia a parcela B
- THEN todas las cards (deuda, consumo agua, consumo luz, historial, pagos) se actualizan para parcela B

### R4: Propietario — Estados de Cuenta multi-parcela

The estados de cuenta page MUST load ECs for the SELECTED parcela.

#### Scenario: Ver ECs de parcela específica

- GIVEN un propietario con parcela A seleccionada
- WHEN accede a estados de cuenta
- THEN ve SOLO los ECs de parcela A, ordenados por período

### R5: Propietario — Informar Pago multi-parcela

The informar pago flow MUST let the user select which parcela to pay for before seeing pending consumos.

The payment MUST be registered against the selected parcelaId.

#### Scenario: Informar pago para parcela específica

- GIVEN un propietario con parcela B seleccionada
- WHEN accede a informar pago
- THEN ve los consumos pendientes de parcela B
- AND el pago se registra con parcelaId = B

## Coverage

| Domain | Type | Requirements | Scenarios |
|--------|------|-------------|-----------|
| Admin Propiedades | New | 1 | 1 |
| Propietario UI (general) | New | 1 | 2 |
| Propietario Dashboard | New | 1 | 1 |
| Propietario Estados Cuenta | New | 1 | 1 |
| Propietario Informar Pago | New | 1 | 1 |

- Happy paths: covered
- Edge cases: single-parcela scenario covered
- Error states: covered (propietario sin parcela — existing behavior unchanged)
