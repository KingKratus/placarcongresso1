
# Plano: Melhorias na Aba Tendências

## 1. Diagrama de Sankey — Fluxo de Migração

Adicionar um diagrama visual de fluxo mostrando quantos parlamentares migraram entre classificações (Governo → Centro → Oposição) entre dois anos selecionados.

**Implementação:**
- Usar a biblioteca `recharts` que já está instalada — porém recharts NÃO tem componente Sankey nativo.
- Alternativa: Criar um **diagrama de fluxo visual customizado** usando SVG puro (sem dependência extra), com nós (Governo/Centro/Oposição) à esquerda (ano anterior) e direita (ano atual), conectados por faixas proporcionais ao número de parlamentares.
- O diagrama será adicionado **acima** da lista de migração existente, complementando-a (não substituindo).
- Dados já disponíveis: as migrations calculadas nos componentes atuais já têm `classPrev` e `classCurr`.

**Arquivos:**
- `src/components/insights/SankeyMigration.tsx` — Novo componente SVG reutilizável
- `src/components/CentroTrendsCamara.tsx` — Integrar o Sankey na seção "Migração entre Anos"
- `src/components/CentroTrendsSenado.tsx` — Idem para Senado

## 2. Filtros por Tema — ⚠️ Limitação de Dados

**Problema:** O banco de dados atual NÃO possui categorização temática das votações. As tabelas `votacoes` e `votacoes_senado` têm `proposicao_tipo` e `proposicao_ementa` mas não um campo de tema/categoria (econômico, social, fiscal, etc.).

**Proposta viável:** Implementar um filtro por **tipo de proposição** (`proposicao_tipo`: PEC, PL, MPV, PDL, etc.) como proxy inicial para análise temática. Isso já permite separar, por exemplo, Medidas Provisórias (frequentemente econômicas) de PLs ordinários.

- Adicionar um Select de filtro por tipo de proposição na seção de tendências
- Recalcular os scores e migrações apenas com votações do tipo selecionado
- Isso requer uma query adicional que cruza `votos_deputados` + `votacoes` para filtrar

**Arquivos:**
- `src/components/CentroTrendsCamara.tsx` — Adicionar filtro por tipo
- `src/components/CentroTrendsSenado.tsx` — Idem

| Arquivo | Mudança |
|---------|---------|
| `src/components/insights/SankeyMigration.tsx` | Novo — Diagrama SVG de fluxo de migração |
| `src/components/CentroTrendsCamara.tsx` | Integrar Sankey + filtro por tipo de proposição |
| `src/components/CentroTrendsSenado.tsx` | Integrar Sankey + filtro por tipo de proposição |

Nenhuma migração de banco necessária.
