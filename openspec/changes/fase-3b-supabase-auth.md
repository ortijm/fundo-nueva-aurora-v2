# SDD Change: fase-3b-supabase-auth

## Status: COMPLETED

## Executive Summary
Reemplazó NextAuth por Supabase Auth. El login ahora es con email + password en vez de username. Se eliminaron dependencias de next-auth, bcryptjs, @auth/prisma-adapter y @vercel/blob.

## Cambios Realizados

### Archivos creados
| Archivo | Descripción |
|---------|-------------|
| `lib/supabase/client.ts` | Cliente Supabase para el navegador |
| `lib/supabase/server.ts` | Cliente Supabase para Server Actions |
| `lib/supabase/middleware.ts` | Middleware para cookie refresh + sesión |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `lib/auth.ts` | ✅ Reescribir: usa Supabase Auth + Prisma lookup |
| `proxy.ts` | ✅ Middleware con Supabase en vez de NextAuth |
| `app/login/login-form.tsx` | ✅ Login con email + Supabase Auth |
| `app/admin/propiedades/actions.ts` | ✅ Crear/editar usuarios en Supabase Auth |
| `app/propietario/configuracion/actions.ts` | ✅ Change password via Supabase Auth |
| `app/api/auth/reset-password/route.ts` | ✅ Reset password via Supabase Auth admin |
| `prisma/seed.ts` | ✅ Crea usuarios en Supabase Auth |
| `prisma/schema.prisma` | ✅ Campo `supabaseId` en Usuario |
| `components/providers/session-provider.tsx` | ✅ Simplificado (sin NextAuth) |
| `components/layout/sidebar.tsx` | ✅ Logout via Supabase Auth |
| `.env` | ➕ NEXT_PUBLIC_SUPABASE_ANON_KEY |
| `.env.example` | 🔧 Actualizado |

### Archivos eliminados
| Archivo | Razón |
|---------|-------|
| `app/api/auth/[...nextauth]/route.ts` | Reemplazado por Supabase Auth |
| `types/next-auth.d.ts` | Ya no existe next-auth |

### Dependencias eliminadas
- `next-auth` → reemplazado por `@supabase/ssr`
- `@auth/prisma-adapter` → ya no necesario
- `bcryptjs` / `@types/bcryptjs` → Supabase Auth maneja hashing
- `@vercel/blob` → reemplazado por `@supabase/supabase-js`

### Nuevas dependencias
- `@supabase/supabase-js` (admin client)
- `@supabase/ssr` (server/client/middleware)

## Credenciales (login con EMAIL ahora)
- Admin: `admin@nuevaaurora.cl` / `admin123`
- Propietario: `propietario@ejemplo.cl` / `prop123`

## Notas
- Login cambió de username a email
- Las contraseñas ahora las maneja Supabase Auth (no más bcrypt en BD)
- El middleware usa Supabase cookies en vez de NextAuth JWT
- RLS está listo para configurarse (las tablas están preparadas)
