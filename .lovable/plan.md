

## Plan: Advanced Filters, Senate Governism Methods, and New Features

### Problem Analysis

1. **No "titulares only" filter**: The Câmara API returns ~513 deputados (titulares) but the app fetches 600 with `itens=600` which includes suplentes. Senado API returns all exercising senators including suplentes. There's no UI filter for this.
2. **Senate governism limited to single method**: Currently only compares with "Líder do Governo" orientation. User wants alternative methods like comparing with the average vote of the government leader's party (currently PSD per the data — but actually the gov coalition lead party).
3. **Dashboard missing party-average stat**: No stat showing how many senators voted with/against the government party average.
4. **Various code quality issues**: `useDeputados` fetches from the external API every page load (no caching), Navbar `partidos` prop requires `id` field which Senado doesn't have (line 108: `p.id`), filter resets are incomplete.

### Implementation Steps

#### 1. Add "Titulares" filter for Câmara

- The Câmara API supports `?idLegislatura=57` (current legislature) which returns only titulares (~513). Current query uses `itens=600` without legislature filter.
- Add a toggle "Apenas Titulares" in `ClassificationFilter` and the Câmara page.
- In `useDeputados.ts`, add the `idLegislatura=57` parameter to the API call (this naturally filters to titulares of the current legislature).
- Add a `conditionFilter` state in `Index.tsx` with options: "Todos", "Titulares" (legislature-based).

#### 2. Add alternative governism methods for Senate

- Currently: compares each senator's votes to the Líder do Governo orientation.
- New method: "Média do Partido do Líder" — compare each senator's vote pattern to the average voting pattern of senators from the government leader's party.
- Add a `Select` in `StatsPanelSenado` or `Senado.tsx` to toggle method: "Líder do Governo" (default) | "Média Partido Gov".
- For "Média Partido Gov" method:
  - Identify gov party (configurable, default to party with highest avg score or "PT" which has 100% alignment).
  - For each votação, compute majority vote of gov party senators → use that as the reference instead of explicit orientation.
  - This is a frontend-only calculation using existing `votos_senadores` data, no sync changes needed.

#### 3. Add dashboard stat: "Votaram com a média do partido do governo"

- In `StatsPanelSenado`, add a new stat card showing how many senators voted above/below the gov party average.
- Compute: gov party avg score → count senators with score >= gov party avg.
- Display as a new `StatItem` or a separate highlight card.

#### 4. New filter: filter by UF in Câmara and Senado dashboards

- Add a UF `Select` dropdown in `ClassificationFilter` and `ClassificationFilterSenado`.
- Filter deputies/senators by their UF.

#### 5. New suggested features

- **"Sem Dados" filter**: Already exists in Navbar but not in `ClassificationFilter` buttons — add it.
- **Score range slider**: Allow filtering by score range (e.g., 40%-60%) to find swing voters.
- **Sort options**: Allow sorting cards by score (asc/desc), name, party, UF.

#### 6. Bug fixes

- **Navbar partidos `id` field**: Senado page creates `partidosForNavbar` with index as `id` but the Select uses `p.id` as key. This works but is fragile. Fix type consistency.
- **Insights page hardcoded year 2025**: `useState(2025)` should be `useState(new Date().getFullYear())`.
- **ClassificationFilter doesn't show "Sem Dados"**: Missing from the filter buttons but exists in Navbar dropdown.

### Technical Details

**Titulares filter (`useDeputados.ts`)**:
```
// Change API call to include legislature
fetch(`${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600&idLegislatura=57`)
```
This naturally returns only titulares. Add a toggle to switch between current legislature (titulares) and all.

**Senate alternative governism (`Senado.tsx` + new hook)**:
- Create `useSenadoGovMethod` hook that takes `analises`, `votos_senadores` data, and a method parameter.
- For "Média Partido Gov": query `votos_senadores` for gov party senators, compute per-votação majority, then recalculate all scores client-side.
- Display recalculated scores alongside original scores.

**New stat in StatsPanelSenado**:
- Compute gov party (PT currently has 100% alignment) average score.
- Count senators with `score >= govPartyAvg`.
- Add StatItem: "Acima da Média Gov" with count.

**Files to modify**:
- `src/hooks/useDeputados.ts` — add legislature filter
- `src/pages/Index.tsx` — add titulares toggle, UF filter, sort options
- `src/pages/Senado.tsx` — add governism method selector, UF filter
- `src/components/ClassificationFilter.tsx` — add "Sem Dados" button, UF filter
- `src/components/ClassificationFilterSenado.tsx` — same
- `src/components/StatsPanelSenado.tsx` — add gov party avg stat, method selector
- `src/components/StatsPanel.tsx` — add titulares count
- `src/pages/Insights.tsx` — fix hardcoded year
- `src/components/Navbar.tsx` — fix partidos type

**New files**:
- None required; all changes fit in existing files.

