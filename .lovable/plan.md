# Plano: Proposições Legislativas com IA no Perfil do Parlamentar

## Resumo

Adicionar uma nova seção nas páginas de perfil de deputados e senadores que busca proposições legislativas (PL, PEC, PRC, PLP, etc.) da API oficial da Câmara/Senado, classifica tematicamente com IA, e gera insights automáticos por tema. A IA do chat flutuante tambem podera buscar proposicoes de parlamentares especificos.

## 1. Nova Edge Function: `fetch-proposicoes`

Cria uma edge function que busca proposicoes legislativas de um parlamentar via APIs publicas:

- **Camara**: `https://dadosabertos.camara.leg.br/api/v2/proposicoes?idDeputadoAutor={id}`
- **Senado**: `https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?codigoParticipante={id}`

A function retorna as proposicoes ja classificadas tematicamente pela IA (Gemini Flash Lite), com cache no banco para evitar re-classificacao.

**Arquivo**: `supabase/functions/fetch-proposicoes/index.ts`

## 2. Nova Tabela: `proposicoes_parlamentares`

Armazena proposicoes ja buscadas e classificadas como cache:

- `parlamentar_id` (integer)
- `casa` (text: camara/senado)
- `tipo` (text: PL, PEC, PRC, etc.)
- `numero` (text)
- `ano` (integer)
- `ementa` (text)
- `tema` (text, classificado por IA)
- `url` (text)
- `data_apresentacao` (timestamp)

RLS: publicamente legivel, insert/update apenas via service role.

## 3. Nova Edge Function: `insights-proposicoes`

Recebe um `parlamentar_id` + `casa` e gera insights com Gemini Flash:

- Resumo tematico das proposicoes
- Areas de foco do parlamentar
- Tendencias ao longo dos mandatos
- Retorna texto markdown com a analise

**Arquivo**: `supabase/functions/insights-proposicoes/index.ts`

## 4. UI: Aba "Proposicoes" no Perfil do Parlamentar

Adiciona uma aba/secao nova em `DeputadoDetail.tsx` e `SenadorDetail.tsx`:

- Listagem de proposicoes com badges tematicos coloridos
- Filtros por tipo (PL, PEC, PRC, PLP), ano e tema
- Busca textual na ementa
- Botao "Gerar Insights com IA" que chama a edge function e exibe analise em markdown
- Resumo estatistico: contagem por tipo e por tema (mini grafico de barras)

## 5. Contexto do Chat Flutuante

Atualizar `ask-ai` para incluir proposicoes do parlamentar quando o usuario estiver no perfil:

- O `FloatingChat` passara contexto da pagina atual (id do parlamentar, casa)
- A edge function buscara proposicoes da tabela cache para enriquecer o contexto

## Detalhes Tecnicos


| Componente      | Arquivo                                            | Mudanca                               |
| --------------- | -------------------------------------------------- | ------------------------------------- |
| Edge Function   | `supabase/functions/fetch-proposicoes/index.ts`    | Novo - busca + classifica proposicoes |
| Edge Function   | `supabase/functions/insights-proposicoes/index.ts` | Novo - gera insights por IA           |
| Migration       | `supabase/migrations/...`                          | Tabela `proposicoes_parlamentares`    |
| Deputado Detail | `src/pages/DeputadoDetail.tsx`                     | Nova secao Proposicoes com tabs       |
| Senador Detail  | `src/pages/SenadorDetail.tsx`                      | Nova secao Proposicoes com tabs       |
| Floating Chat   | `src/components/FloatingChat.tsx`                  | Passa contexto da pagina atual        |
| Ask AI          | `supabase/functions/ask-ai/index.ts`               | Aceita contexto de parlamentar        |


**Modelo IA**: Gemini 2.5 Flash Lite para classificacao tematica (rapido/barato), Gemini 2.5 Flash para insights narrativos.

&nbsp;

&nbsp;

Add opção de colocar chave API para a pessoa usar sua própria IA pra fazer perguntas sobre os dados públicos da plataforma. 