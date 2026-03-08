

# Plan: Insights Dashboard Tab (Câmara + Senado)

## Overview
Create a new dedicated "Insights" page accessible from the Navbar (alongside Câmara/Senado toggle), combining data from both houses into rich visualizations.

## New Page: `src/pages/Insights.tsx`
A standalone page that fetches `analises_deputados` and `analises_senadores` for the selected year and renders multiple chart cards in a responsive grid. Charts use Recharts (already installed).

### Charts to include:

1. **Distribuição Governo/Oposição/Centro** -- Side-by-side donut charts comparing Câmara vs Senado classification breakdown
2. **Alinhamento Médio por Partido (Câmara vs Senado)** -- Grouped horizontal bar chart showing parties that exist in both houses, comparing their average alignment
3. **Top 10 Mais Alinhados / Menos Alinhados** -- Two bar charts (Câmara + Senado combined) showing the 10 highest and 10 lowest scoring parliamentarians
4. **Distribuição de Scores (Histograma)** -- Histogram with bins (0-10, 10-20, ..., 90-100) overlaying Câmara and Senado distributions
5. **Alinhamento por UF (Mapa de Calor)** -- Table/heatmap showing average alignment per state, split by Câmara/Senado columns
6. **Partidos com Maior Divergência Câmara vs Senado** -- Bar chart highlighting parties where the alignment difference between houses is largest
7. **Volume de Votações por Mês** -- Line chart showing how many votações occurred each month (from `votacoes` and `votacoes_senado` tables)

## New Hook: `src/hooks/useInsightsData.ts`
Fetches from multiple tables in parallel for the selected year:
- `analises_deputados` (scores, classifications, parties, UFs)
- `analises_senadores` (same)
- `votacoes` (dates for volume chart)
- `votacoes_senado` (dates for volume chart)

## Navigation Changes
- **`src/components/Navbar.tsx`**: Add a third button "Insights" in the toggle group next to Câmara/Senado, navigating to `/insights`
- **`src/App.tsx`**: Add route `<Route path="/insights" element={<Insights />} />`

## Files
| File | Action |
|------|--------|
| `src/pages/Insights.tsx` | Create -- main insights page with all charts |
| `src/hooks/useInsightsData.ts` | Create -- data fetching hook |
| `src/components/Navbar.tsx` | Edit -- add Insights button |
| `src/App.tsx` | Edit -- add route |

No database changes needed -- all data already exists in the tables.

