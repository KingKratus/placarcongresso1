Plano de implementação

1. Melhorar a aba Emendas $ em Insights
- Manter o filtro de ano no topo e destacar que ele controla a consulta antes do recálculo dos rankings.
- Adicionar um filtro de tema específico ao bloco principal de controles, junto do ano, para o ranking de risco ser recalculado imediatamente no recorte selecionado.
- Ajustar o ranking por tema e por autor para respeitar explicitamente os filtros de ano, tema, tipo, UF, subtema, risco e busca.
- Incluir botões separados de exportação do ranking de risco:
  - CSV por tema
  - CSV por autor
  - PDF por tema
  - PDF por autor
- Os arquivos terão: nome do tema/autor, risco, total de emendas, empenhado, liquidado, pago, taxa de pagamento (pago/liquidado) e taxa de execução (pago/empenhado).

2. Modal ao clicar nas linhas do ranking
- Tornar as linhas dos rankings clicáveis.
- Ao clicar em um tema ou autor, abrir um modal com:
  - resumo do grupo selecionado;
  - totais de empenhado, liquidado e pago;
  - taxa de pagamento e taxa de execução;
  - contagem por risco;
  - lista das emendas que justificam o ranking.
- Em cada emenda do modal, mostrar:
  - código, tipo, ano, autor, partido/UF;
  - tema/subtema, função/subfunção;
  - valores empenhado/liquidado/pago;
  - taxas de pagamento e execução;
  - risco e estágio;
  - resumo IA;
  - botão de link quando houver URL oficial ou quando for possível montar uma busca oficial pelo código.

3. Links de emendas PIX, individuais e bancada
- Ampliar o tipo local `EmendaOrcamentaria` para ler `raw_data` e possíveis campos de link/documentos vindos do Portal.
- Criar uma função segura no front para extrair link oficial de:
  - `raw_data.link`, `raw_data.url`, `raw_data.uri`, `raw_data.urlDocumento`, documentos etc., quando existirem;
  - fallback para busca no Portal da Transparência com o código/número da emenda.
- Mostrar botão “Ver emenda” nas linhas de dados completos e no modal de validação.
- Evidenciar tipo de emenda no card/tabela: PIX/transferência especial quando o texto indicar, individual, bancada, relator ou comissão.

4. Insights adicionais de impacto público
- Adicionar cards de insights automáticos na aba Emendas $:
  - municípios/localidades atendidos no recorte;
  - parlamentares com municípios atendidos;
  - temas com maior cobertura territorial;
  - quantidade estimada de escolas/educação, saúde e segurança atendidas com base em tema, subtema, função, subfunção e resumo IA;
  - maiores gargalos: alto empenho com baixa execução;
  - concentração por autor/partido/UF.
- Para “quais escolas foram ajudadas”, usar apenas o que estiver disponível nos dados (`localidade_gasto`, `publico_beneficiado`, `resumo_ia`, `raw_data`/documentos). Se o Portal não fornecer o nome da escola, a interface mostrará como “entidade não identificada no retorno oficial”, evitando inventar dados.

5. Sync manual de Emendas $ no painel Admin
- Criar um componente de sync administrativo para Emendas $, ou inserir um card na aba “Syncs”.
- Controles previstos:
  - ano;
  - tipo de emenda: todos, individual, bancada, comissão, relator, PIX/transferência especial quando aplicável;
  - número de páginas;
  - incluir documentos.
- Ao executar, chamar `sync-emendas-transparencia` com os parâmetros escolhidos.
- Exibir barra de progresso estimada e log visual com etapas: início, buscando Portal, classificação IA, gravação e conclusão/erro.
- Atualizar contadores e histórico após o sync.

6. Sync manual no perfil do parlamentar
- Na aba de emendas do perfil parlamentar, adicionar uma seção “Emendas $ do Portal da Transparência”.
- Botão para sincronizar emendas orçamentárias daquele parlamentar/ano usando `nomeAutor` e ano.
- Mostrar barra de progresso/log durante a chamada.
- Depois do sync, carregar e exibir resumo financeiro do parlamentar:
  - total de emendas $ encontradas;
  - empenhado, liquidado, pago;
  - taxa de execução;
  - riscos por emenda;
  - links oficiais.
- Isso será integrado tanto em `DeputadoDetail` quanto em `SenadorDetail`, reutilizando um componente único para evitar duplicação.

7. Backend/logs do sync
- Ajustar a função `sync-emendas-transparencia` para também registrar `sync_runs` e `sync_run_events` com `casa = 'emendas_orcamentarias'`.
- Registrar eventos reais durante execução: validação, páginas buscadas, registros únicos, classificação IA, gravação, conclusão ou erro.
- Retornar `runId`, `fetched`, `upserted`, `ano` e resumo para o front.
- Manter a exigência de login para sync e continuar usando a chave do Portal já configurada.
- Não abrir escrita pública na tabela de emendas; a gravação continuará restrita à função com credenciais de backend.

8. Teste do sync
- Após a aprovação, implementar e testar a chamada da função com um recorte pequeno, por exemplo ano atual e 1 página.
- Validar se os logs aparecem no painel e se os dados recalculam o ranking.
- Verificar o comportamento de erro quando o Portal retorna falha ou sem dados.

Arquivos principais a alterar
- `src/components/insights/EmendasOrcamentariasTab.tsx`
- `src/components/EmendasTab.tsx`
- `src/pages/Admin.tsx`
- `src/pages/DeputadoDetail.tsx`
- `src/pages/SenadorDetail.tsx`
- possível novo componente reutilizável para sync/financeiro de emendas por parlamentar
- `supabase/functions/sync-emendas-transparencia/index.ts`

Observações técnicas
- Não vou alterar os arquivos autogerados do backend (`src/integrations/supabase/client.ts` ou `types.ts`).
- A exportação PDF continuará usando o utilitário existente `downloadPdfReport`.
- Onde o dado oficial não trouxer entidade beneficiada específica, a interface vai indicar ausência do dado em vez de gerar inferências falsas.
- Se o Portal não fornecer link direto em algum item, o botão usará um fallback de busca oficial pelo código/número da emenda.