Plano de implementação

1. Comparação lado a lado entre dois parlamentares em Insights
- Criar uma nova aba em Insights: “Comparar Parlamentares”.
- Permitir selecionar dois parlamentares, misturando Câmara e Senado.
- Mostrar lado a lado:
  - score atual, classificação, partido, UF e total de votos;
  - posição no ranking geral e no ranking da própria Casa;
  - evolução por ano usando os dados já carregados em `allYearsDeputados` e `allYearsSenadores`;
  - diferença de score ano a ano;
  - cartões de leitura rápida: quem subiu, quem caiu, quem tem mais votos computados, quem está mais próximo do governo/oposição/centro.
- Fazer o layout responsivo para caber bem no mobile, com seletores empilhados e gráficos adaptados.

2. Timeline de tramitação com filtros, resumo e barra de progresso
- Refatorar `TramitacaoTimeline` para classificar cada evento em categorias:
  - Comissão
  - Plenário
  - Sanção/Presidência
  - Mesa/Diretoria
  - Arquivamento/encerramento
  - Outros
- Adicionar filtros por tipo de evento, busca textual e botão “limpar filtros”.
- Mostrar contagem do tipo: “12 de 38 eventos exibidos”.
- Adicionar uma barra de progresso legislativo baseada nas etapas detectadas:

```text
Apresentação -> Comissões -> Plenário -> Revisão/Outra Casa -> Sanção/Promulgação
```

- Mostrar cards de insights da tramitação:
  - etapa atual provável;
  - se já passou por comissão;
  - se já foi pautado em plenário;
  - se já foi votado/aprovado/rejeitado/arquivado;
  - última movimentação relevante;
  - nível de avanço em percentual.
- Melhorar a função de backend `fetch-tramitacao` para devolver metadados normalizados quando possível, sem quebrar o componente atual.

3. Projetos pautados e votados em Insights
- Enriquecer a aba “Projetos” com uma seção de leitura executiva:
  - projetos já votados no ano;
  - projetos provavelmente pautados/levados a plenário;
  - distribuição por Casa, órgão, tipo e resultado;
  - lista rápida “pautados/votados recentemente”.
- Aproveitar os dados de `votacoes` e `votacoes_senado` já carregados.
- Adicionar chips de status como “Votado”, “Aprovado”, “Rejeitado”, “Sem resultado identificado”.

4. Botão para enviar relatórios completos por email
- Como não há domínio de email configurado no projeto, o primeiro passo será abrir a configuração de domínio de envio.
- Depois que o domínio for configurado, preparar o envio de app emails com um template de “Relatório Legislativo Completo”.
- Criar um botão reutilizável “Enviar relatório por email” nos pontos mais úteis:
  - comparação de dois parlamentares;
  - timeline de tramitação;
  - detalhes de projeto/votação;
  - aba de prioridades, se fizer sentido no layout.
- O relatório será enviado para o email do usuário logado por padrão, com opção de informar outro destinatário quando apropriado.
- O conteúdo do email incluirá resumo, métricas principais, links para a página e dados estruturados do relatório.

5. Testar e endurecer a API pública
- Revisar a função `api-dados`, incluindo validação de parâmetros:
  - `casa`: apenas `camara` ou `senado`;
  - `tipo`: apenas `analises`, `votacoes`, `votos`;
  - `ano`: faixa segura;
  - `limit` e `offset`: limites numéricos seguros;
  - `votacao_id`: obrigatório e com tamanho máximo quando `tipo=votos`.
- Corrigir inconsistência atual da documentação: os exemplos mencionam filtro por partido em `tipo=votos`, mas a função hoje exige `votacao_id`; vou alinhar implementação e tutorial.
- Opcionalmente adicionar filtros públicos seguros por `partido`, `uf`, `classificacao` e paginação consistente onde existirem colunas compatíveis.
- Testar endpoints com chave válida/inválida, parâmetros válidos/inválidos e paginação.
- Manter a API restrita a dados públicos; nada de expor perfis, chaves, logs, conversas ou papéis de usuário.

6. Tutorial ultra detalhado para API e agente de IA
- Expandir a página de Documentação com uma nova seção “Agentes de IA com API pública”.
- Incluir passo a passo prático:
  - gerar chave no Perfil;
  - entender URL base, autenticação e paginação;
  - chamar rankings, votações e votos;
  - montar um agente que consulta endpoints públicos;
  - exemplos de prompts, ferramentas e fluxo de raciocínio seguro;
  - boas práticas para não expor chave no frontend público de terceiros;
  - limites, paginação, cache e tratamento de erros.
- Incluir exemplos em cURL e JavaScript/fetch.
- Deixar claro quais endpoints são públicos mediante chave e quais dados nunca devem ser pedidos ao agente.

7. Correções de bugs e vulnerabilidades
- Corrigir vulnerabilidade já identificada: usuários autenticados conseguem ver sync runs do sistema quando `user_id IS NULL`. A nova política restringirá esses registros a administradores, mantendo cada usuário vendo apenas seus próprios logs.
- Corrigir a view `prioridade_agregada`: como está com `security_invoker`, usuários anônimos/autenticados podem receber agregados zerados por causa das regras de votos individuais. Vou trocar para uma agregação pública segura que exponha apenas contagens e médias, sem revelar votos individuais.
- Endurecer `api_keys`:
  - limitar tamanho/nome da chave;
  - impedir nomes excessivos;
  - evitar exposição desnecessária quando possível;
  - manter RLS por usuário.
- Endurecer chamadas de Edge Functions no frontend usando `supabase.functions.invoke` onde for melhor, reduzindo URLs manuais frágeis.
- Revisar CORS e respostas de erro das funções novas/alteradas.

8. Validação final
- Rodar build/testes/lint quando possível.
- Testar a função pública da API com chamadas reais.
- Testar a timeline com proposições de Câmara e Senado.
- Verificar visualmente os principais fluxos em mobile, especialmente porque o usuário está em viewport estreita.

Observação sobre email
- O envio por email depende de configurar um domínio remetente. Assim que você aprovar este plano, começarei a implementação; quando chegar na parte de email, vou abrir o fluxo de configuração do domínio e depois continuarei o restante automaticamente.