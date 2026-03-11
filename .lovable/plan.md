

## Plan: Insights Improvements, Map, Sync, API Endpoint, and Bug Fixes

### Problem Analysis

1. **Missing votações**: `sync-camara` only stores votações where the government gave an orientation. All other votações are discarded, so Insights/Projetos shows an incomplete picture.
2. **Search broken for numbers**: The search input works but the `Input` component doesn't restrict `type`, so mobile keyboards may not show numbers. The real issue is that `proposicao_numero` is stored inconsistently (sometimes null).
3. **No individual votes in detail dialog**: The detail dialog shows aggregated counts by party but doesn't list individual parliamentarians and their votes.
4. **No GeoJSON map**: The "Estados" tab uses simple colored boxes instead of an interactive Brazil map.
5. **No API endpoint generation**: Authenticated users can't expose their data via an API.
6. **Sync completeness**: Hourly cron jobs work but the data coverage is limited to gov-oriented votações only.

---

### Implementation Steps

#### 1. Expand sync-camara to store ALL votações (not just gov-oriented)

- Fetch the bulk votações file (`votacoes-{year}.json`) in addition to orientações.
- Store ALL votações in the `votacoes` table (metadata: tipo, numero, ementa, data, orgao).
- Continue calculating alignment scores only for gov-oriented votações, but store all votação records so they appear in Insights.
- Fetch votes for ALL votações (not just gov-oriented) so individual votes are available in the detail dialog.

#### 2. Expand sync-senado similarly

- Already stores all votações from the orientações API, but individual votes (`votos_senadores`) are only stored for gov-oriented ones.
- Store individual votes for all votações so they appear in the detail view.

#### 3. Fix ProjetosTab search and filters

- Make search match `tipo + " " + numero` as a combined string (e.g., searching "PL 1234" works).
- Add `inputMode="search"` to the Input so mobile keyboards show the full keyboard.
- Reset filters properly when switching between tabs.

#### 4. Add individual parliamentarian votes to detail dialog

- In `openProjectDetail`, fetch votos with parliamentarian names, parties, and UFs.
- For Câmara: join `votos_deputados` with `analises_deputados` to get names/parties.
- For Senado: join `votos_senadores` with `analises_senadores`.
- Display a searchable/sortable table of individual votes below the party breakdown.

#### 5. Add Brazil GeoJSON map to Estados tab

- Use a lightweight inline SVG-based Brazil map (no external GeoJSON dependency needed — use a simple component with state paths).
- Color each state by average alignment score (Governo=green, Centro=yellow, Oposição=red).
- Click a state to filter/show details for that UF.
- Show toggle for Câmara vs Senado data on the map.

#### 6. Create API endpoint edge function

- New edge function `api-dados` that serves public data (analises, votações) as JSON.
- Authenticated users can generate an API key (stored in a new `api_keys` table) from the Perfil page.
- The edge function validates the API key and returns requested data.
- Endpoints: `/api-dados?casa=camara&ano=2025`, `/api-dados?tipo=votacoes`, etc.

#### 7. Database changes

- New table `api_keys`: `id, user_id, api_key (text, unique), created_at, is_active`.
- RLS: users can view/manage their own keys.

#### 8. Bug fixes

- `useInsightsData`: The 5000 limit on votações may truncate data. Increase or paginate.
- `ProjetosTab` pie chart Cell colors are positional — if a category is filtered out, colors shift. Fix by mapping explicitly.
- `sync-camara` body parsing: `req.text()` is called after auth which may have already consumed the body in some edge cases. Clone the request or buffer the body first.

---

### Technical Details

**sync-camara changes (index.ts)**:
- After fetching orientações, also fetch the bulk votações file to get ALL votação IDs.
- For votações without gov orientation, still fetch metadata and store in `votacoes` table.
- Fetch votes for all votações (batched), store in `votos_deputados`.
- Only compute alignment scores for gov-oriented votações.

**ProjetosTab detail dialog expansion**:
- Add a new state `individualVotes` with `{nome, partido, uf, voto, foto}[]`.
- Render a searchable table with columns: Nome, Partido, UF, Voto.
- Add a search input within the dialog to filter by name/party.

**Brazil map component**:
- Create `src/components/insights/BrazilMap.tsx` with inline SVG paths for all 27 states.
- Accept `data: {uf: string, value: number, classificacao: string}[]` as props.
- Color-code by classification majority or average score.
- On click, show a popover or sidebar with UF details.

**API endpoint (`supabase/functions/api-dados/index.ts`)**:
- Validate API key from `Authorization: Bearer <key>` or `?apikey=<key>`.
- Query params: `casa`, `ano`, `tipo` (analises|votacoes|votos).
- Return paginated JSON with proper CORS headers.

