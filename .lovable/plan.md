Plano de implementação

1. Solicitar e armazenar a chave da API do Portal da Transparência
- Vou pedir sua chave como segredo seguro do projeto antes de implementar a chamada real.
- A chave não ficará no frontend nem no código público; será usada somente em funções backend.
- A integração usará o header oficial `chave-api-dados` contra `https://api.portaldatransparencia.gov.br/api-de-dados/emendas`.

2. Criar base própria para emendas parlamentares orçamentárias
- Criar uma nova tabela separada da atual `emendas_parlamentares_cache`, para não confundir com emendas/proposições legislativas.
- Campos principais:
  - código da emenda, ano, número, tipo de emenda, autor/nome do autor
  - localidade do gasto, função, subfunção
  - valores: empenhado, liquidado, pago, restos inscritos/cancelados/pagos
  - classificação IA: tema, subtema, área pública, público beneficiado, risco, qualidade de execução, resumo analítico, confiança
  - metadados brutos e data de sincronização
- RLS: leitura pública para dashboards; escrita bloqueada para usuários e feita apenas pelo backend.
- Índices para ano, autor, partido inferido, UF/localidade, tema, tipo e valores.

3. Backend de sincronização com Portal da Transparência
- Criar função `sync-emendas-transparencia` para buscar páginas da API com filtros por ano, tipo, autor, função e subfunção.
- Suportar os três tipos de emendas orçamentárias exibidos pelo Portal, mantendo o texto oficial do tipo retornado pela API.
- Normalizar valores monetários que vêm como texto para números confiáveis.
- Fazer paginação, deduplicação por `codigoEmenda` e cache incremental.
- Buscar opcionalmente documentos relacionados em `/emendas/documentos/{codigo}` para enriquecer fase/execução quando necessário.
- Usar IA no backend para tematizar em lotes: Saúde, Segurança, Educação, Infraestrutura, Assistência, Agro, Meio Ambiente, Economia, etc., além de subtemas mais específicos.

4. Nova aba em Insights: “Emendas Orçamentárias”
- Adicionar uma aba específica dentro de Insights, deixando claro que são emendas de execução orçamentária do Portal da Transparência.
- Painel com filtros detalhados:
  - ano, tipo de emenda, tema IA, subtema IA, função/subfunção, autor, partido/UF quando disponível, localidade do gasto, faixa de valor, status de execução.
- Cards executivos:
  - total empenhado, liquidado, pago
  - taxa de execução: pago / empenhado
  - emendas com maior valor pago
  - emendas paradas ou com baixa execução
  - concentração por saúde, segurança, educação etc.
- Tabela completa com exportação CSV/PDF.

5. Gráficos e rankings de emendas orçamentárias
- Gráficos planejados:
  - barras por tema/subtema e por função/subfunção
  - evolução anual de empenhado/liquidado/pago
  - funil financeiro: empenhado -> liquidado -> pago
  - ranking de autores por valor empenhado/pago e taxa de execução
  - ranking por partidos e UFs, quando conseguirmos associar autor aos parlamentares já existentes no app
  - mapa por localidade/UF do gasto
  - matriz tema × tipo de emenda
  - alertas: alto empenho com baixo pagamento, alta concentração por parlamentar/partido/localidade
- Comparação lado a lado: dois parlamentares/partidos/UFs por volume, execução e temas.

6. Relatórios e exportação
- Reaproveitar a estrutura atual de PDF/CSV e adicionar:
  - PDF executivo de emendas orçamentárias com gráficos e insights IA
  - CSV completo do recorte filtrado
  - PDF/CSV nos rankings de parlamentares, partidos, UFs, proposições e projetos
- Incluir insights no PDF: principais áreas financiadas, execução, gargalos e destaques.

7. Melhorias na aba Proposições
- Adicionar subtemas por IA além do tema geral.
- Mostrar funil legislativo por parlamentar: apresentadas, em tramitação, avançadas, aprovadas/transformadas, arquivadas/rejeitadas.
- Mais rankings: tipos de proposição mais usados, temas com maior avanço, proposições mais relevantes por peso/status.
- Exportações por CSV/PDF incluindo subtemas e status.

8. Melhorias na aba Projetos
- Adicionar mais métricas nos projetos votados:
  - placar agregado por Casa, tema e órgão
  - polarização por partido
  - projetos com maior divergência entre partidos
  - temas mais votados no ano
  - resultado e situação quando disponível
- Reforçar a leitura de “projetos já votados” e “mais avançados para plenário” com gráficos e filtros.

9. Melhorias no chatbot de IA
- Expandir o contexto do chatbot para incluir:
  - emendas orçamentárias do Portal da Transparência
  - proposições com subtemas
  - rankings e dados de execução financeira
- No modo avançado, liberar consultas seguras à nova tabela de emendas orçamentárias.
- Melhorar as sugestões rápidas do chat com perguntas como:
  - “Quais parlamentares mais destinaram recursos para saúde?”
  - “Compare execução de emendas entre dois partidos”
  - “Quais emendas têm alto empenho e baixo pagamento?”
- Corrigir o streaming para tratar fim de resposta e erros 402/429 de forma mais clara.
- Testar o chat em modo normal e avançado após a implementação.

10. Segurança, validação e testes
- Validar entradas no backend: ano, página, autor, tipo, função/subfunção e limites de paginação.
- Nunca expor a chave do Portal da Transparência no navegador.
- Garantir RLS e escrita bloqueada por usuários comuns.
- Testar:
  - chamada real à API após a chave ser configurada
  - sincronização de ao menos um ano/tipo
  - classificação IA em lote
  - renderização mobile da nova aba
  - exportação CSV/PDF
  - chatbot normal e avançado

Observação importante
- Após sua aprovação, o primeiro passo será solicitar sua chave da API do Portal da Transparência via segredo seguro. Só depois consigo implementar e testar a integração real com a API.