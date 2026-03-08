# Ajuste de Classificação: Critérios do Placar Congresso

## Contexto

O placarcongresso.com usa **percentual de oposicionismo** (inverso do nosso score de governismo):

- Oposicionismo 0–50% = **Governo** → nosso score ≥ 50%
- Oposicionismo 50–70% = **Centrão** → nosso score 30–50%
- Oposicionismo 70–100% = **Oposição** → nosso score ≤ 30%

Atualmente usamos: Governo ≥ 70%, Oposição ≤ 35%. Os novos thresholds serão **Governo ≥ 50%** e **Oposição ≤ 30%**.

## Alterações

### 1. Edge Functions (classificação no backend)

`**supabase/functions/sync-camara/index.ts**` e `**supabase/functions/sync-senado/index.ts**`

- Mudar `score >= 70` → `score >= 50` para Governo
- Mudar `score <= 35` → `score <= 30` para Oposição

### 2. Componentes Frontend (thresholds visuais)

Todos usam `>= 70` e `<= 35` para cores/classificação:

- `src/components/ComparisonView.tsx` (linha 39)
- `src/components/ComparisonViewSenado.tsx` (linha 39)
- `src/components/PartyChart.tsx` (linha 40-41)
- `src/components/PartyChartSenado.tsx` (linha 40-41)

### 3. Simulação de Cenários

`**src/components/insights/AlignmentSimulation.tsx**`

- Mudar `DEFAULT_GOV = 70` → `50`
- Mudar `DEFAULT_OPO = 35` → `30`

### 4. Re-sync dos dados

Após deploy das edge functions, disparar sync para 2023–2026 em ambas as casas para reclassificar todos os parlamentares no banco.

## Resumo de arquivos


| Arquivo                                                         | Ação               |
| --------------------------------------------------------------- | ------------------ |
| `supabase/functions/sync-camara/index.ts`                       | Ajustar thresholds |
| `supabase/functions/sync-senado/index.ts`                       | Ajustar thresholds |
| `src/components/ComparisonView.tsx`                             | Ajustar thresholds |
| `src/components/ComparisonViewSenado.tsx`                       | Ajustar thresholds |
| `src/components/PartyChart.tsx`                                 | Ajustar thresholds |
| `src/components/PartyChartSenado.tsx`                           | Ajustar thresholds |
| `src/components/insights/AlignmentSimulation.tsx`&nbsp;&nbsp; | Ajustar defaults   |
