
The user wants several things bundled. Let me analyze:

1. **Histograma de P-Scores em /desempenho** — `PerformanceHistogram.tsx` já existe, só precisa ser integrado em `Desempenho.tsx`
2. **Teste end-to-end** — ação manual do usuário, vou listar como suggestion
3. **Comparação lado a lado de até 4 deputados com radar chart** — novo componente `PerformanceCompare.tsx` (já iniciado pelo AI antes mas parece não ter sido finalizado)
4. **Job para reprocessar fetch-proposicoes em massa** — `reprocess-proposicoes` já existe; falta botão no Admin para acioná-lo em batch
5. **Teste end-to-end perfil** — ação manual
6. **Estender cron + toggle para Senado** — `calculate-performance` já suporta `casa: "senado"` via parâmetro; falta (a) cron diário pro Senado, (b) toggle no `RankingTable` do Senado / `Senado.tsx`
7. **Botão de sync no Admin para calcular Desempenho** — novo botão em `Admin.tsx` chamando `calculate-performance` para Câmara e Senado
8. **IA com Web Search + leitura Supabase sem dados sensíveis** — nova edge function `ask-ai-tools` (ou estender `ask-ai`) com tool calling: `web_search` e `query_supabase` (whitelist de tabelas: analises_*, proposicoes_parlamentares, deputy_performance_scores, votacoes, votacao_temas — bloqueia profiles, api_keys, sync_*, user_roles, chat_conversations)

Vou checar arquivos relevantes rapidamente para confirmar estado atual.

Plan será conciso.
