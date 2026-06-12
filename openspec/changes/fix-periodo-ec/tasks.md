# Tasks: Fix EC Billing Period Display

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~70 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

---

## Phase 1: Foundation — Helper + Tests (TDD)

- [x] 1.1 **RED**: Write failing tests for `getPeriodoBilling` in `tests/utils.test.ts` — scenarios from R1: mid-year, January→December, preserves day, December, no mutation
- [x] 1.2 **GREEN**: Add `getPeriodoBilling(periodo: Date): Date` to `lib/utils.ts` — subtract 1 month using `Date.setMonth`, add export
- [x] 1.3 Run `npm run test` — all tests pass

## Phase 2: Backend — PDF + Email + Notifications

- [x] 2.1 `lib/pdf/estado-cuenta-pdf.tsx` — Modify internal `fmtPeriodoCorto` (lines 59-63) to subtract 1 month before formatting (R3)
- [x] 2.2 `app/api/ec/[id]/pdf/route.ts` — Import `getPeriodoBilling`, wrap `ec.periodo` in `getPeriodoBilling()` for `periodoLabel` and filename (R2)
- [x] 2.3 `lib/services/email.ts` — Import `getPeriodoBilling`, wrap `ec.periodo` in `getPeriodoBilling()` for email `periodoLabel` (R4)
- [x] 2.4 `app/admin/estados-cuenta/actions.ts` — Import `getPeriodoBilling`, wrap `periodo` in `getPeriodoBilling()` for notification subject (R5)

## Phase 3: UI — Propietario Pages

- [x] 3.1 `app/propietario/estados-cuenta/page.tsx` — Import `getPeriodoBilling`, wrap `ec.periodo` in `getPeriodoBilling()` for `formatPeriodo` (R6)
- [x] 3.2 `app/propietario/dashboard/page.tsx` — Import `getPeriodoBilling`, wrap `ec.periodo` in `getPeriodoBilling()` for table + wrap `mes` for chart labels (R7, R13)
- [x] 3.3 `app/propietario/informar-pago/informar-pago-form.tsx` — Import `getPeriodoBilling`, wrap `c.periodo` in `getPeriodoBilling()` (R10)

## Phase 4: UI — Admin Pages

- [x] 4.1 `app/admin/informar-pago/informar-pago-form.tsx` — Import `getPeriodoBilling`, wrap `c.periodo` in `getPeriodoBilling()` (R11)
- [x] 4.2 `app/admin/validacion/validacion-client.tsx` — Import `getPeriodoBilling`, wrap `c.periodo` in `getPeriodoBilling()` (R12)
- [x] 4.3 `app/admin/estados-cuenta/page.tsx` — Import `getPeriodoBilling`, add legend below period filter explaining corte→facturación (R8)

## Phase 5: Verification

- [x] 5.1 Run `npm run test` — all unit tests pass
- [ ] 5.2 Start dev server `npm run dev`, login as admin, verify dashboard dates
- [ ] 5.3 Verify propietario EC list shows billing period (not corte)
- [ ] 5.4 Generate a PDF from admin EC page — verify header shows billing period
- [ ] 5.5 Verify Gastos Comunes are NOT affected (periodo = billing, correct)
