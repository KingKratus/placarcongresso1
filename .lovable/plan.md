## Plano de implementação

### 1. Mais insights e gráficos na aba de Proposições
- Expandir `ProposicoesTab` com uma seção de leitura executiva mais rica:
  - proposições por status de tramitação: em tramitação, aprovada, arquivada, rejeitada, retirada;
  - taxa de avanço e taxa de aprovação estimada;
  - top temas, top tipos, anos mais produtivos e proporção autor/coautor;
  - ranking das proposições mais relevantes por peso legislativo, status e tema.
- Adicionar novos gráficos:
  - funil/status das proposições;
  - distribuição autor vs coautor;
  - temas por status;
  - matriz tipo x tema;
  - evolução temporal com comparação entre total, aprovadas e em tramitação.
- Melhorar a lista para exibir status, peso/impacto, autoria, tema e botão de tramitação de forma mais clara.

### 2. Insights com gráficos na tramitação
- Expandir `TramitacaoTimeline` para mostrar além da timeline:
  - cards de resumo: total de eventos, comissões percorridas, eventos de plenário, eventos decisivos, dias desde última movimentação;
  - gráfico de barras por tipo de evento: comissão, plenário, sanção, mesa, encerramento, outros;
  - gráfico temporal por ano/mês com volume de movimentações;
  - lista de marcos importantes detectados automaticamente: apresentação, despacho para comissão, parecer, pauta/plenário, votação, sanção/promulgação, arquivamento/rejeição.
- Refinar a barra de progresso para usar os marcos detectados e mostrar uma trilha visual das etapas.
- Manter filtros existentes por tipo e busca textual, mas adicionar filtros de “somente eventos decisivos” e “últimos eventos”.

### 3. Suporte a emendas parlamentares com IA, insights e filtros
- Criar uma nova tabela no backend para cache de emendas parlamentares por parlamentar, com campos como:
  - parlamentar, casa, número/ano/tipo da emenda, proposição vinculada, ementa/texto, situação, valor quando disponível, data, URL oficial;
  - classificação por IA: tema, impacto estimado, área de política pública, público afetado, tipo de benefício, resumo analítico e confiança.
- Criar uma backend function `fetch-emendas` para buscar emendas oficiais, classificar em lote com Lovable AI e salvar em cache.
  - Para Câmara, priorizar endpoints públicos de proposições/emendas quando disponíveis por proposição/autoria.
  - Para Senado, usar os dados oficiais disponíveis e tratar ausência de campos de forma segura.
- Criar uma backend function `insights-emendas` para gerar análise executiva das emendas do parlamentar.
- Criar componente `EmendasTab` e adicionar como nova aba nos detalhes de Deputado e Senador:
  - filtros por ano, tema, proposição vinculada, situação, impacto, busca textual;
  - gráficos por tema, ano, situação, tipo de impacto e valores quando houver;
  - lista detalhada com classificação de IA e links oficiais.
- Observação: onde a API oficial não expuser emendas diretamente por parlamentar, a função retornará um aviso claro e usará o melhor dado disponível em cache/relacionamento de proposições.

### 4. Insights Estados com mais informações, gráficos e lista de parlamentares ao clicar no mapa
- Atualizar `BrazilMap` para receber também os dados de deputados e senadores do ano selecionado.
- Ao clicar em um estado, mostrar:
  - lista de deputados e senadores daquele estado;
  - nome, partido, score, classificação, votos úteis, foto e link para o perfil;
  - contato quando disponível;
  - ranking interno do estado.
- Adicionar gráficos do estado selecionado:
  - distribuição Governo/Centro/Oposição;
  - score médio por partido no estado;
  - comparação Câmara x Senado;
  - top parlamentares e parlamentares mais distantes do governo.
- Manter a experiência responsiva para celular, já que o preview atual está em largura pequena.

### 5. Contato de cada parlamentar
- Criar utilitários/componentes de contato parlamentar para padronizar exibição em cards, mapa e detalhes.
- Deputados:
  - usar o email disponível na API da Câmara quando acessível;
  - quando o email não estiver no banco, buscar sob demanda no endpoint oficial de deputado e mostrar fallback “contato oficial indisponível”.
- Senadores:
  - enriquecer a busca na API do Senado para tentar capturar email, página oficial e/ou telefones de gabinete quando disponíveis;
  - mostrar fallback seguro quando o dado oficial não vier.
- Exibir contatos em:
  - lista de parlamentares no mapa de Estados;
  - páginas `DeputadoDetail` e `SenadorDetail`;
  - cards onde couber sem poluir a interface.
- Não armazenar contato sensível privado; apenas dados públicos oficiais.

### 6. Ajustes de segurança, robustez e bugs
- Validar entradas das novas backend functions com limites e regex para evitar chamadas abusivas.
- Usar cache e paginação para evitar excesso de chamadas às APIs oficiais e à IA.
- Tratar erros de IA: limite de uso, créditos, JSON inválido, timeout e classificação parcial.
- Evitar chamadas de IA no cliente; toda classificação fica no backend.
- Não alterar arquivos autogerados do backend (`client.ts` e `types.ts`) manualmente.

## Detalhes técnicos
- Backend: novas migrações para `emendas_parlamentares_cache` e índices por `parlamentar_id`, `casa`, `ano`, `tema`, `situacao`.
- RLS: leitura pública para dados agregados/oficiais; escrita bloqueada ao público, feita apenas pelas backend functions.
- IA: usar Lovable AI para classificação estruturada das emendas em lotes pequenos, com cache para não reclassificar sem necessidade.
- Frontend: novos componentes reutilizáveis para `EmendasTab`, `ParlamentarContact`, gráficos de tramitação e painel detalhado de UF.
- Testes: rodar typecheck/build e corrigir problemas de import, tipos, renderização responsiva e erros de runtime.