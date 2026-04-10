

# Plano: Melhorias Diversas - Insights, Mobile, IA e Temas

## Resumo

5 melhorias: (1) badges de tema nos gráficos Insights, (2) integração OpenRouter para análise/chat, (3) painel de distribuição temática com pizza, (4) busca sempre visível no mobile, (5) testes das funcionalidades existentes.

## 1. Badges de Tema nas Votações (Insights)

Adicionar badges coloridos por tema na aba **Projetos** (`ProjetosTab.tsx`), onde as votações individuais são listadas. Usar o hook `useVotacaoTemas` para obter o mapa de temas e exibir um `Badge` colorido ao lado de cada votação.

- Criar mapa de cores por tema (Econômico = azul, Social = roxo, etc.)
- Integrar `useVotacaoTemas` no `ProjetosTab`
- Exibir badge ao lado da ementa de cada votação

**Arquivo**: `src/components/insights/ProjetosTab.tsx`

## 2. Integração OpenRouter para Análise e Perguntas

Armazenar a chave OpenRouter como secret (`OPENROUTER_API_KEY`). Criar uma edge function `ask-ai` que aceita uma pergunta + contexto de dados legislativos e retorna análise via OpenRouter. No frontend, adicionar um componente de chat/perguntas na aba Insights.

- Solicitar secret via `add_secret`
- Edge function: `supabase/functions/ask-ai/index.ts` — proxy para OpenRouter API
- Componente frontend: input de pergunta + resposta com markdown
- Integrar na página Insights como nova aba ou painel lateral

**Arquivos**: `supabase/functions/ask-ai/index.ts` (novo), `src/components/insights/AskAI.tsx` (novo), `src/pages/Insights.tsx`

## 3. Painel de Distribuição Temática (Pizza)

Adicionar nova aba "Temas" ou seção na aba Visão Geral com gráfico de pizza mostrando distribuição de temas das votações do ano selecionado. Usar `useVotacaoTemas` para obter os dados, com botão para classificar automaticamente se ainda não classificado.

- `PieChart` com as contagens por tema
- Filtros Câmara/Senado
- Botão "Classificar com IA" quando sem dados

**Arquivo**: `src/pages/Insights.tsx` (nova aba "Temas")

## 4. Busca Sempre Visível no Mobile

Remover a condição `(!isMobile || filtersOpen)` apenas para o campo de busca. A busca ficará sempre visível, enquanto os filtros de Ano/Partido/Classificação continuam colapsáveis.

- Extrair o input de busca para fora do bloco condicional
- Manter os selects dentro do bloco colapsável

**Arquivo**: `src/components/Navbar.tsx`

## 5. Teste e Verificação

Verificar as funcionalidades existentes (Sankey, classificação temática, busca) via ferramentas de debug após implementação.

## Detalhes Técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/components/Navbar.tsx` | Busca sempre visível no mobile |
| `src/components/insights/ProjetosTab.tsx` | Badges de tema |
| `src/pages/Insights.tsx` | Nova aba Temas com pizza chart |
| `supabase/functions/ask-ai/index.ts` | Novo — proxy OpenRouter |
| `src/components/insights/AskAI.tsx` | Novo — componente de perguntas IA |

**Nota de segurança**: A chave OpenRouter será armazenada como secret do projeto, acessível apenas via edge functions. Nunca exposta no frontend.

