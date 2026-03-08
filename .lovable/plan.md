

# Plan: Sync 2023/2024, Fix Metadata, Add Detail Page Filters

## Problems Found

1. **Votações metadata is NULL for ~95% of records** -- 2025 data was synced with an older edge function version that didn't fetch metadata from the API. Only 2026 records have `descricao`, `proposicao_tipo`, `proposicao_numero`, `proposicao_ementa` populated.
2. **Orientações empty for 2025 votação IDs** -- the orientacoes query returns empty for many deputy votes, meaning the deputy detail page can't show government orientation.
3. **No 2023 data** -- the year selector only has 2024-2026.
4. **No filters on detail page** -- user wants year filter, vote type filter, alignment filter on the deputy detail page.

## Plan

### 1. Add 2023 to Year Selector
- Update `Navbar.tsx` ANOS array: `[2023, 2024, 2025, 2026]`

### 2. Add Filters to Deputy Detail Page (`DeputadoDetail.tsx`)
- **Year filter**: dropdown to filter votos by ano (All / 2023 / 2024 / 2025 / 2026)
- **Vote type filter**: Sim / Não / All
- **Alignment filter**: Alinhado / Desalinhado / All
- Add a search input for proposição text
- Apply filters to the paginated votos list

### 3. Trigger Sync for 2023, 2024, 2025
- Use `supabase--curl_edge_functions` to invoke `sync-camara` for years 2023, 2024, and 2025 sequentially
- This will backfill metadata (proposição tipo, número, ementa) and orientações for all years

### 4. Fix Sync Button to Support Multi-Year
- Update `useAnalises.ts` sync function to also allow syncing specific years
- Add visual feedback showing which years have data

### Files to Change
- `src/components/Navbar.tsx` -- add 2023 to ANOS
- `src/pages/DeputadoDetail.tsx` -- add year/vote/alignment/search filters
- Edge function invocations for 2023, 2024, 2025 via curl tool

