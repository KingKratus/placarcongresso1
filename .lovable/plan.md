

# Plano: Melhorias UX/UI na Aba Insights

## Resumo

Implementar 3 melhorias de interatividade nos gráficos da aba Insights, conforme o relatório do usuário.

## Alterações

### 1. Tooltips Detalhados (todos os gráficos)

Enriquecer os tooltips existentes para mostrar informações adicionais:

- **Pie Charts (Classificação)**: Mostrar valor absoluto + percentual (ex: "Governo: 245 deputados (48%)")
- **Bar Charts (Top 10, Partidos, Divergência)**: Mostrar partido, casa, score E número de votos/parlamentares quando disponível
- **Line Charts (Tendência, Volume)**: Mostrar volume de votações ao lado do percentual de alinhamento
- **Histograma**: Mostrar total por faixa e percentual do total

Criar um componente `EnhancedTooltip` reutilizável para padronizar o estilo visual dos tooltips com fundo escuro, bordas arredondadas e informações organizadas.

**Arquivo**: `src/pages/Insights.tsx` (tooltips inline) + `src/components/insights/EnhancedTooltip.tsx` (novo)

### 2. Filtros Globais Dinâmicos

Adicionar filtros de **Partido** e **UF** no topo da página Insights (ao lado do seletor de Ano já existente) que afetam TODAS as abas simultaneamente:

- Adicionar `Select` para Partido (extraído dos dados carregados) e UF
- Filtrar `deputados` e `senadores` nos `useMemo` existentes antes de calcular agregações
- Os filtros são aplicados via `useMemo` sobre os dados já carregados (sem novas queries)

**Arquivo**: `src/pages/Insights.tsx`

### 3. Legendas Clicáveis (Toggle de séries)

Nos gráficos comparativos Câmara vs Senado, permitir clicar na legenda para ocultar/exibir uma casa:

- Adicionar estado `hiddenSeries` com `useState<Set<string>>`
- Nos `Legend`, usar `onClick` handler para toggle
- Nas `Bar`/`Line`, renderizar condicionalmente baseado no set
- Aplicar opacidade visual na legenda quando série está oculta
- Aplicar nos gráficos: Partidos, Divergência, Volume, Histograma, PeriodAlignmentChart

**Arquivos**: `src/pages/Insights.tsx`, `src/components/insights/PeriodAlignmentChart.tsx`

## Detalhes Técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/components/insights/EnhancedTooltip.tsx` | Novo componente de tooltip customizado |
| `src/pages/Insights.tsx` | Filtros globais, tooltips aprimorados, legendas clicáveis |
| `src/components/insights/PeriodAlignmentChart.tsx` | Legendas clicáveis, tooltip aprimorado |
| `src/components/insights/AlignmentTrendChart.tsx` | Tooltip aprimorado |

Nenhuma alteração de banco de dados necessária. Todas as melhorias são puramente de frontend.

