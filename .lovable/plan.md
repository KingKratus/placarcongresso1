

# Plan: Add Proposição Year + Fix Links

## Problem
The `votacoes` table has `proposicao_tipo` and `proposicao_numero` but no `proposicao_ano`. This means:
- Links like "PL 192" can't find the right bill (there could be PL 192 from different years)
- The Proposição search link is unreliable without the year

The Câmara API's `proposicoesAfetadas` response already includes an `ano` field per proposição -- we just aren't extracting it.

## Changes

### 1. Database Migration
Add `proposicao_ano` column to `votacoes` table:
```sql
ALTER TABLE votacoes ADD COLUMN proposicao_ano integer;
```
Also add to `votacoes_senado` for future Senate support:
```sql
ALTER TABLE votacoes_senado ADD COLUMN materia_ano integer;
```

### 2. Update `sync-camara` Edge Function
Extract `prop?.ano` from `proposicoesAfetadas` and store it as `proposicao_ano` in the votação record (line ~167).

### 3. Update `DeputadoDetail.tsx`
- Display year with bill label: "PL 192/2023" instead of "PL 192"
- Fix Proposição link to include year: `?q=PL+192/2023`
- Fix Google search link to include year
- All links now use `proposicao_ano` when available

### 4. Re-sync to Backfill
Invoke `sync-camara` for 2023-2026 to populate the new `proposicao_ano` field for existing records.

## Files
- `supabase/functions/sync-camara/index.ts` -- extract `prop?.ano`
- `src/pages/DeputadoDetail.tsx` -- display year, fix links
- DB migration for new columns

