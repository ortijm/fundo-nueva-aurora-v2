# SDD Change: fase-1-seguridad

## Status: COMPLETED

## Executive Summary
Endureció la seguridad del sistema y mejoró la calidad del código: rate limiting en login/forgot-password, CSP header, verificación de isActive en sesiones activas, Zod en todas las Server Actions, y error handling centralizado.

## Completed Steps

### A. Rate Limiting
| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | ✅ Agregado modelo `RateLimit` |
| `lib/ratelimit.ts` | ✅ Creado — checkRateLimit + resetRateLimit |
| `app/api/auth/forgot-password/route.ts` | ✅ Rate limit por IP + mensaje genérico (no leak de emails) |
| `lib/auth.ts` | ✅ Rate limit en authorize (5 intentos/15 min por IP) |

### B. CSP Header
| Archivo | Acción |
|---------|--------|
| `next.config.ts` | ✅ Content-Security-Policy agregado + headers existentes mantenidos |

### C. isActive en Sesiones
| Archivo | Acción |
|---------|--------|
| `lib/auth.ts` | ✅ Verificación de `isActive` en JWT callback por cada request |
| `app/propietario/configuracion/page.tsx` | ✅ Manejo de null/error en getProfile |

### D. Error Handling Centralizado
| Archivo | Acción |
|---------|--------|
| `lib/server-action-utils.ts` | ✅ Creado — `ActionResult<T>`, `withErrorHandling()`, `unauthorized()`, `validationError()`, `getResultData()` |

### E. Zod + Error Handling en Server Actions
11 action files refactorizados con Zod schemas + `withErrorHandling`:
- `app/admin/propiedades/actions.ts`
- `app/admin/consumos/actions.ts`
- `app/admin/gastos/actions.ts`
- `app/admin/estados-cuenta/actions.ts`
- `app/admin/notificaciones/actions.ts`
- `app/admin/validacion/actions.ts`
- `app/admin/configuracion/actions.ts`
- `app/admin/fondos/actions.ts`
- `app/admin/informar-pago/actions.ts`
- `app/propietario/informar-pago/actions.ts`
- `app/propietario/configuracion/actions.ts`

### Client components arreglados
7 client components actualizados para usar `getResultData()`:
- `estados-cuenta-client.tsx`, `gastos-client.tsx`, `notificaciones-client.tsx`
- `consumos-client.tsx`, `informar-pago-form.tsx` (admin + propietario)
- `configuracion-form.tsx`, `page.tsx` (propietario)

## Resumen de cambios
- **15 archivos modificados**
- **+1,351 líneas insertadas, -952 eliminadas**
- **Build exitoso — 26 rutas compiladas, TypeScript OK**

## Next Recommended
Continue with **Fase 2 — Brevo SMTP**:
- ✅ Configurado: SMTP de Brevo en .env (reemplaza Gmail personal)
- ✅ Sender verificado: fundonuevaauroraspa@gmail.com
- Opcional: migrar a @react-pdf/renderer templates
