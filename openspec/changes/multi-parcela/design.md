# Design: Multi-Parcela Support

**Change**: multi-parcela
**Date**: 2026-05-22

## Technical Approach

Use **URL-based state** (`searchParams`) for parcela selection + a shared **ParcelaSelector** Client Component. Server Components read `?parcela=X` from searchParams to query the correct parcela's data. This avoids adding client-side state management or new API routes.

## Architecture Decisions

### Decision: URL-based parcela selection (searchParams)

**Choice**: Pass selected parcelaId via URL `?parcela=X`
**Alternatives**: React Context, Zustand store, client state only
**Rationale**: Server Components need the selected parcelaId to query data. searchParams is the only way to pass dynamic state to Server Components without extra API routes. It also makes parcela selection shareable via URL.

### Decision: Shared ParcelaSelector component

**Choice**: Single `app/propietario/_components/parcela-selector.tsx` used by all 3 sections
**Alternatives**: Duplicate selector in each page
**Rationale**: Same logic (fetch user parcelas, render dropdown, navigate with searchParams) across 3 pages. Reuse reduces bugs and maintenance.

### Decision: No new DB queries or schema changes

**Choice**: Schema already supports N parcelas. Only change query strategy from `findFirst` to `findMany`.
**Alternatives**: Add join table, add unique index, etc.
**Rationale**: Schema is already correct. No migration, zero risk.

## Data Flow

```
Browser                          Server Component
──────                            ───────────────
                                            
Propietario logs in → auth() → session.user.id
                                            
ParcelaSelector                   prisma.parcela.findMany({
  reads user parcelas  ←───        where: { propietarioId } 
})                                            
                                            
User selects parcela                          
  → router.push(`?parcela=${id}`)            
    → Server Component re-renders            
      → reads searchParams.parcela           
      → queries data for THAT parcela        
      → renders dashboard/ECs/pagos          
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/admin/propiedades/propiedades-client.tsx` | Modify | Remove `.filter()` that hides propietarios with active parcelas (lines 364-370) |
| `app/propietario/_components/parcela-selector.tsx` | Create | Reusable dropdown. Reads user parcelas, navigates on change |
| `app/propietario/dashboard/page.tsx` | Modify | Accept `searchParams.parcela`, query specific parcela, pass parcelas to selector |
| `app/propietario/estados-cuenta/page.tsx` | Modify | Accept `searchParams.parcela`, query specific parcela ECs |
| `app/propietario/informar-pago/page.tsx` | Modify | Accept `searchParams.parcela`, load consumos for specific parcela |
| `app/propietario/informar-pago/actions.ts` | Modify | Accept explicit `parcelaId` param instead of `findFirst` |

No new files beyond `parcela-selector.tsx`.

## Interfaces

```typescript
// ParcelaSelector props
interface ParcelaSelectorProps {
  parcelas: Array<{ id: string; numero: string; nombre: string }>;
  selectedId: string;
  basePath: string; // e.g., "/propietario/dashboard"
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | ParcelaSelector renders options, navigates on change | Vitest + React Testing Library |
| Unit | Admin filter removed — all propietarios shown | Snapshot or assert options length |
| Manual | Propietario with 1 parcela → no selector, same behavior | Manual QA |
| Manual | Propietario with 2+ parcelas → selector + data switching | Manual QA |
| Manual | Informar pago with multi-parcela | Manual QA |

## Migration / Rollout

No migration required. Existing propietarios with 1 parcela see zero change. Admins can immediately assign existing propietarios to new parcelas.

## Open Questions

None.
