

# Plan: Fix Sync, Data Quality, Security, and Scheduling

## Problems Identified

1. **Votações metadata is completely empty** -- all 734 votacoes records have NULL for `descricao`, `proposicao_tipo`, `proposicao_numero`, `proposicao_ementa`. The edge function tries to extract these from the orientações bulk JSON, but those fields don't exist in that dataset.
2. **No individual votes for 2024** -- votos_deputados has 130k rows for 2025 and 10k for 2026, but zero for 2024.
3. **Edge function crashes on cron calls** -- `req.json()` fails if body is empty or malformed.
4. **Cron is hourly** -- user wants 24h schedule.
5. **Type safety issues** -- DeputadoDetail uses `as any` casts for votos_deputados queries.
6. **Portal da Câmara link** points to the API JSON endpoint, not the human-readable page.

## Plan

### 1. Rewrite Edge Function (`sync-camara/index.ts`)
- Add safe body parsing with try/catch (fallback to current year)
- After fetching orientações and identifying votação IDs with government orientation, fetch votação metadata from `GET /api/v2/votacoes/{id}` in batches of 10 to populate `descricao`, `proposicao_tipo`, `proposicao_numero`, `proposicao_ementa` (the bulk file doesn't have this data)
- Keep the existing vote-fetching logic (batches of 20)
- Add error handling for individual API failures without stopping the whole sync

### 2. Update Cron Schedule to 24h
- SQL update via insert tool: `SELECT cron.unschedule('sync-camara-hourly')` then reschedule with `'0 3 * * *'` (daily at 3 AM UTC)

### 3. Fix DeputadoDetail Page
- Remove `as any` casts -- use proper typed queries
- Fix "Portal da Câmara" link to use `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=` or voting page URL properly
- Handle the 1000-row Supabase default limit by paginating the votos query

### 4. Fix useAnalises Hook
- Remove unused `limit` parameter from `syncDeputados`

### 5. Minor Fixes
- Navbar: default year to current year (2026) instead of hardcoded 2025
- Edge function: use service role key in cron job (already does, via SUPABASE_SERVICE_ROLE_KEY inside function)

### Files to Change
- `supabase/functions/sync-camara/index.ts` -- rewrite with votação metadata fetch + safe body parsing
- `src/pages/DeputadoDetail.tsx` -- fix type casts, fix portal links, handle query limits
- `src/hooks/useAnalises.ts` -- clean up unused parameter
- `src/pages/Index.tsx` -- default ano to current year
- Database: unschedule hourly cron, create daily cron

