

## Plan: End-to-End Fixes, Bancada Filter, Sync Improvements, and Bug Corrections

### Bugs Found During Testing

1. **Titulares toggle broken**: When toggled OFF, `legislatura = 0`, then `0 || undefined = undefined`, defaulting back to `57`. The toggle does nothing.
2. **"600 DEPUTADOS" displayed** even with Titulares ON — the Câmara API with `idLegislatura=57` returns ~513, but the heading uses `filteredDeputies.length` which is correct. The 600 comes from `itens=600` param. This is actually working if the API returns fewer. The real bug is #1.
3. **Methodology card inconsistency**: StatsPanel says "GOVERNO: > 50%" but `sync-camara` classifies at `>= 70%`. StatsPanelSenado says "> 50%" but `sync-senado` also uses `>= 70%`. The thresholds shown to users are wrong.
4. **Gov party identification for Senate**: Picks party with highest average score (PROGRESSISTAS in 2026) instead of the actual government leader's party. Should default to PT (the president's party) or allow user configuration.
5. **Votações Câmara mostly "Outros"**: The bulk `votacoes-{year}.json` file may not have `proposicaoObjeto` for many entries, causing `parseProposicaoObjeto` to return nulls. Need to also parse from `proposicoesAfetadas` in the bulk data or fetch metadata via API.
6. **Sync only fetches votes for gov-oriented votações**: Step 4 in `sync-camara` only iterates `govVotacaoIds`, meaning non-gov votações have no individual votes in the DB. The Projetos detail falls back to the Câmara API which is slow and rate-limited.
7. **`Sem Dados` count always 0** on Câmara: The sync classifies deputies as Centro/Governo/Oposição only — never "Sem Dados" because `relevant === 0` sets "Sem Dados" but these deputies typically have zero votes and the `deputyScores` map only includes deputies who actually voted.

### Implementation Steps

#### 1. Fix Titulares Toggle

**File**: `src/pages/Index.tsx`
- Change `const legislatura = titulares ? 57 : 0;` to use `undefined` when off: `const legislatura = titulares ? 57 : undefined;`
- Update `useDeputados` call: `useDeputados(legislatura)` (remove `|| undefined`)

**File**: `src/hooks/useDeputados.ts`
- When `legislatura` is undefined, omit `idLegislatura` param entirely from API URL to fetch ALL deputies (including suplentes)

#### 2. Add Bancada/Bloco Parlamentar Filter

**File**: `src/components/ClassificationFilter.tsx`
- Add a new `Select` for "Bancada" with predefined coalition groups:
  - "Base Gov" (PT, PSD, MDB, PP, PV, PCdoB, Solidariedade, PSDB, etc.)
  - "Independente" (parties not in either bloc)
  - "Oposição" (PL, NOVO, UNIÃO, etc.)
- Define a static mapping `BANCADAS` grouping party siglas
- Add prop `bancadaFilter` + `onBancadaFilterChange`

**File**: `src/pages/Index.tsx`
- Add `bancadaFilter` state
- Add filter logic in `filteredDeputies` to match party against bancada groups

**File**: `src/pages/Senado.tsx`
- Same bancada filter for Senate

#### 3. Fix Methodology Card Thresholds

**Files**: `src/components/StatsPanel.tsx`, `src/components/StatsPanelSenado.tsx`
- Update displayed thresholds to match actual sync logic:
  - GOVERNO: >= 70%
  - CENTRO: 36%-69%
  - OPOSIÇÃO: <= 35%

#### 4. Fix Gov Party Identification for Senate

**File**: `src/pages/Senado.tsx`
- Instead of picking party with highest avg score, hardcode the government leader's party as "PT" (Lula's party) with a configurable override
- Add a text input or select in the gov method selector to let users choose which party represents the government

**File**: `src/components/StatsPanelSenado.tsx`
- When method is "partido-gov", show the selected gov party name

#### 5. Improve Votações Metadata Parsing in sync-camara

**File**: `supabase/functions/sync-camara/index.ts`
- In the bulk votações processing, also check `proposicoesAfetadas` array (which many bulk entries have) to extract tipo/numero/ementa
- Add fallback: if `proposicaoObjeto` is null, try `proposicoesAfetadas[0]` fields
- For entries still missing tipo, try to fetch metadata from API in small batches (limit to ~50 to avoid timeouts)

#### 6. Expand Vote Fetching to ALL Votações (not just gov-oriented)

**File**: `supabase/functions/sync-camara/index.ts`
- After Step 4 (gov-oriented votes), add Step 4b: fetch votes for remaining votações (non-gov) in batches
- Use a smaller batch size and add timeout protection
- This ensures ProjetosTab can show individual votes for any votação without API fallback

**File**: `supabase/functions/sync-senado/index.ts`
- Already stores votes for all votações — no change needed

#### 7. Fix "Sem Dados" Classification

**File**: `supabase/functions/sync-camara/index.ts`
- After computing scores, also create analysis records for deputies from the external API that have zero votes
- Fetch the full deputy list from `analises_deputados` or the Câmara API and insert "Sem Dados" records for any not in `deputyScores`

#### 8. Edge Function Improvements

**Files**: All edge functions
- `sync-camara`: Add timeout protection for large batches, better error messages per step
- `sync-senado`: Add progress percentage in log events
- `agenda-live`: Add caching headers and error handling for individual API failures (if Câmara API fails, still return Senado data)
- `api-dados`: Add rate limiting per API key (optional), add CORS headers for all standard Supabase client headers

#### 9. Bug Fix Roundup

- **`useDeputados.ts`**: Add `AbortController` for cleanup on unmount to prevent state updates on unmounted component
- **`useSyncStatus.ts` line 83**: `status.remainingSeconds > 0` in useEffect dependency is evaluated once — should use `status.remainingSeconds` as the actual dependency
- **`Insights.tsx`**: The `ANOS` array is hardcoded `[2023, 2024, 2025, 2026]` — make dynamic based on current year

### Technical Details

**Bancada mapping** (approximate for current legislature):
```
const BANCADAS = {
  "Base Gov": ["PT","PSD","MDB","PP","PV","PCdoB","SOLIDARIEDADE","PSDB","AVANTE","PRD","AGIR"],
  "Oposição": ["PL","NOVO","UNIÃO"],
  "Independente": [] // everything else
};
```

**Titulares fix**:
```typescript
// Index.tsx
const legislatura = titulares ? 57 : undefined;
const { deputados } = useDeputados(legislatura);

// useDeputados.ts
export function useDeputados(legislatura?: number) {
  const url = legislatura
    ? `${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600&idLegislatura=${legislatura}`
    : `${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600`;
  // ...
}
```

**Vote expansion in sync-camara**: After the existing Step 4 loop, add a second loop for non-gov votações fetching only votes (no score calculation), limited to prevent timeouts.

### Files to Modify
- `src/pages/Index.tsx` — titulares fix, bancada filter
- `src/pages/Senado.tsx` — bancada filter, gov party fix
- `src/hooks/useDeputados.ts` — legislatura param fix
- `src/components/ClassificationFilter.tsx` — bancada select
- `src/components/ClassificationFilterSenado.tsx` — bancada select
- `src/components/StatsPanel.tsx` — methodology thresholds
- `src/components/StatsPanelSenado.tsx` — methodology thresholds, gov party
- `src/pages/Insights.tsx` — dynamic ANOS
- `src/hooks/useSyncStatus.ts` — useEffect dependency fix
- `supabase/functions/sync-camara/index.ts` — metadata parsing, vote expansion, sem dados
- `supabase/functions/agenda-live/index.ts` — resilience improvements
- `supabase/functions/api-dados/index.ts` — CORS headers fix

