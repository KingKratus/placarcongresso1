## Plan: Sync Execution, Mobile UI Optimization, and "Sem Dados" Investigation

### Findings from Sync Testing

**Senado sync**: Ran successfully — 81 senators analyzed, 6 votações with gov orientation in 2026, 388 votes stored. Only 1 "Sem Dados" (Davi Alcolumbre, who is Senate president and doesn't vote). This is correct behavior.

**Câmara sync**: Last run stored 528 deputies, 51 gov-oriented votações, 20,699 votes. Zero "Sem Dados" because all deputies who appear in vote records (gov or non-gov) also had at least 1 gov-oriented vote. This is expected — deputies who were never present in *any* vote session are simply not in the API data. The "Sem Dados" category is working correctly.

**Why some deputies might appear without data**: Deputies who took office mid-year or were on leave have no vote records in the API. The sync correctly marks them "Sem Dados" only if they appear in at least one non-gov session. Currently, Step 4b fetches up to 100 non-gov votações — this is a good coverage expansion.

### Mobile UI Issues (375px viewport)

1. **Navbar overflows**: The nav tabs (Câmara/Senado/Insights/Docs) plus search/filters don't wrap well on 375px. The tab bar extends beyond the viewport.
2. **Filter section too wide**: UF, Bancada, and Sort selects are fixed-width (`w-28`, `w-36`) causing horizontal overflow on mobile.
3. **Grid layout**: `xl:grid-cols-12` sidebar/main split means on mobile the sidebar (StatsPanel) appears above the main content — this is correct but takes up a lot of vertical space.
4. **TabsList overflow**: 5 tabs (Deputados/Ranking/Partidos/Comparativo/Tendências) overflow on mobile.

### Implementation Steps

#### 1. Mobile-Responsive Navbar

- Make nav tabs scrollable horizontally on mobile with `overflow-x-auto`
- Stack search and filters vertically on small screens
- Hide less important filters behind a collapsible "Filtros" button on mobile
- Reduce padding and font sizes for mobile

#### 2. Mobile-Responsive Filters

- Make classification filter buttons smaller on mobile (drop labels, keep icons + counts)
- Make Select components full-width on mobile (`w-full sm:w-28`)
- Stack filter row vertically on narrow screens

#### 3. Mobile TabsList

- Add horizontal scrolling to `TabsList` on mobile
- Or use a dropdown/select for tab navigation on small screens

#### 4. Collapsible StatsPanel on Mobile

- Make the StatsPanel collapsible on mobile (default collapsed showing just summary counts)
- Use an accordion or sheet pattern

#### 5. Run Both Syncs for Validation

- The Câmara sync is on cooldown (429). No code changes needed for sync logic — it's working correctly.
- The "Sem Dados" mechanism works: deputies with 0 gov-relevant votes get classified correctly.

#### 6. Increase Non-Gov Vote Coverage

- Increase `NON_GOV_LIMIT` from 100 to 200 in `sync-camara` to capture more deputies who only voted in non-gov sessions
- This has minimal timeout risk since the Câmara API is fast for individual vote lookups

### Technical Details

**Navbar mobile refactor**: Wrap the tab navigation in a scrollable container. Move search/filters into a collapsible section triggered by a filter icon button visible only on mobile.

**Filter buttons mobile**: Use responsive classes to show abbreviated labels:

```
// On mobile: icon + count only
// On desktop: icon + label + count
<span className="hidden sm:inline">{item.label}</span>
```

**TabsList scrollable**: Add `overflow-x-auto` to the TabsList container and prevent wrapping.

**StatsPanel collapsible**: Wrap in an `Accordion` on mobile using `useIsMobile()` hook.

### Files to Modify

- `src/components/Navbar.tsx` — mobile-responsive layout with scrollable tabs and collapsible filters
- `src/components/ClassificationFilter.tsx` — responsive button labels, full-width selects on mobile
- `src/components/ClassificationFilterSenado.tsx` — same responsive changes
- `src/pages/Index.tsx` — collapsible sidebar on mobile
- `src/pages/Senado.tsx` — collapsible sidebar on mobile
- `supabase/functions/sync-camara/index.ts` — increase NON_GOV_LIMIT to 200

&nbsp;

&nbsp;

&nbsp;

Add a period filter (month/quarter) to see government alignment over time within the same year 

Fix all bugs