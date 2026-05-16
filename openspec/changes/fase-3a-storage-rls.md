# SDD Change: fase-3a-storage-rls

## Status: COMPLETED

## Executive Summary
Migró el almacenamiento de comprobantes de pago de Vercel Blob a Supabase Storage. Se eliminó la dependencia de @vercel/blob.

## Completed Steps

| Archivo | Acción |
|---------|--------|
| `lib/supabase/admin.ts` | 🆕 Cliente Supabase con service_role key |
| `lib/supabase/storage.ts` | 🆕 Helper uploadComprobante() |
| `app/admin/informar-pago/actions.ts` | 🔧 Reemplazó @vercel/blob por Supabase Storage |
| `app/propietario/informar-pago/actions.ts` | 🔧 Reemplazó @vercel/blob por Supabase Storage |
| `app/api/comprobantes/[filename]/route.ts` | 🔧 Redirige a Supabase Storage |
| `.env` | ➕ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY |
| `.env.example` | 🔧 Actualizado |
| `package.json` | ➕ @supabase/supabase-js, ➖ @vercel/blob |

## Detalles Técnicos
- Bucket: `comprobantes` (público)
- URL de archivos: `{SUPABASE_URL}/storage/v1/object/public/comprobantes/{filename}`
- Tipo de contenido soportado: JPG, PNG, PDF (hasta 5MB)

## Next Recommended
Continue with **Fase 3b — Supabase Auth** para reemplazar NextAuth:
- Migrar login de username a email
- RLS policies (con Supabase Auth los policies aplican automáticamente)
- Eliminar bcrypt, next-auth
