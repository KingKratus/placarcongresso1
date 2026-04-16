The user wants three things:

1. Test the alignment comparison filters (vs Média PL, vs specific parliamentarian) on the main page to verify frontend behavior
2. Add more insights to the Tendências tab and more options to the Insights page (with mobile sizing fixes)
3. Fix scrolling issue on the "Comparar partidos" blocks

Let me explore the relevant files quickly.

## Plan: Melhorias em Insights, Tendências, Comparações e Mobile

### 1. Verificação dos Filtros de Alinhamento (Câmara)

Testar end-to-end na preview:

- Aplicar "Comparar: vs Média PL" + ordenar por Score ↓ para confirmar que os deputados mais alinhados ao PL aparecem primeiro
- Aplicar "Comparar: vs [parlamentar específico]" e validar que a similaridade é calculada corretamente
- Confirmar que badges/scores no `DeputyCard` refletem o score efetivo (similaridade)

Se o `DeputyCard` mostra apenas o score bruto, adicionar um indicador visual de "modo comparação ativo" no header da listagem mostrando a referência usada.

### 2. Fix Scroll na Comparação de Partidos

**Arquivo**: `src/components/ComparisonView.tsx` (e `ComparisonViewSenado.tsx`)

- Os blocos de seleção de partidos não têm scroll quando muitos partidos são listados
- Adicionar `max-h-[60vh] overflow-y-auto` nas listas de partidos selecionáveis
- Garantir scrollbar customizada visível no mobile

### 3. Mais Insights na Aba Tendências

**Arquivo**: `src/components/CentroTrendsCamara.tsx` (e versão Senado se existir)
Adicionar novos cards/gráficos:

- **Migração de classificação**: deputados que mudaram de Governo↔Centro↔Oposição entre anos
- **Top 5 mais voláteis**: maior variação de score entre períodos
- **Concentração regional**: heatmap simples de score médio por UF
- **Evolução do bloco Centro**: linha temporal de quantos deputados são "Centro" por mês/trimestre

### 4. Mais Opções na Aba Insights

**Arquivo**: `src/pages/Insights.tsx` e componentes em `src/components/insights/`
Adicionar:

- **Seletor de período** (2023/2024/2025/2026 + "Todos") aplicado a todos os gráficos
- **Filtro por casa** (Câmara/Senado/Ambos) global
- **Novo card "Polarização"**: índice calculado pela distância entre médias Gov vs Oposição
- **Novo card "Top Temas em Disputa"**: temas com maior dispersão de votos
- **Export PDF/PNG** dos insights principais

### 5. Ajustes Mobile (viewport 375px)

- `src/pages/Insights.tsx`: reduzir paddings (`p-2 sm:p-4`), font-sizes (`text-xs sm:text-sm`), e empilhar grids em 1 coluna abaixo de 640px
- Tabs com scroll horizontal já existente — garantir que novos cards tenham `overflow-x-auto`
- Gráficos Recharts: usar `ResponsiveContainer` com `aspect={1.2}` no mobile
- `CentroTrendsCamara`: ajustar grids para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

### Detalhes Técnicos


| Arquivo                                   | Mudança                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `src/components/ComparisonView.tsx`       | Adicionar scroll nas listas de partidos                    |
| `src/components/ComparisonViewSenado.tsx` | Mesmo fix de scroll                                        |
| `src/components/CentroTrendsCamara.tsx`   | Novos cards: migração, voláteis, regional, evolução Centro |
| `src/pages/Insights.tsx`                  | Seletor período/casa global, ajustes mobile                |
| `src/components/insights/`                | Novo card Polarização, Temas em Disputa                    |
| `src/pages/Index.tsx`                     | Indicador visual de modo comparação ativo                  |
| Browser test                              | Validar filtros vs Média PL e vs parlamentar               |


**Sem mudanças de schema** — todos os novos insights derivam dos dados já existentes em `analises_deputados`, `analises_senadores`, `votacao_temas` e `votacoes`.

&nbsp;

 Quanto na Aba Câmara dos Deputados e Senado add opção de ver alinhamento também de um ano pro ano e de anos pros outros já que locais como o Senado está bem distorcido por ter poucas votações. 