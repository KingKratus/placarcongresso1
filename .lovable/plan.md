

# Plan: Trigger sync backfill + fix type casts + verify links

## Current State
- `proposicao_ano` column exists in `votacoes` table and is in the generated types
- `sync-camara` already extracts `prop?.ano` and stores it as `proposicao_ano`
- `DeputadoDetail.tsx` uses `(votacao as any).proposicao_ano` — unnecessary cast since the type already has this field
- Links already include the year when available — logic is correct

## Changes

### 1. Fix unnecessary type casts in `DeputadoDetail.tsx`
Replace all `(votacao as any).proposicao_ano` with `votacao.proposicao_ano` since the Votacao type (`Tables<"votacoes">`) already includes this field.

Three locations:
- Line 472: bill label display
- Line 498: Proposição search link  
- Line 520: Google search link

### 2. Trigger sync-camara for years 2023-2026
Use the edge function invocation tool to call `sync-camara` for each year (2023, 2024, 2025, 2026) to backfill the `proposicao_ano` field on existing votação records.

### 3. Link verification
After the sync, the links will work correctly:
- **Proposição**: `?q=PL+192/2023` — includes year for exact match
- **Google**: `site:camara.leg.br+PL+192/2023` — includes year
- **API**: always works (uses `id_votacao`)

## Files to Modify
- `src/pages/DeputadoDetail.tsx` — remove `as any` casts (3 spots)

## Edge Function Calls
- Invoke `sync-camara` with `{ "ano": 2023 }`, `{ "ano": 2024 }`, `{ "ano": 2025 }`, `{ "ano": 2026 }`

