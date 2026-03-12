
Objetivo aprovado: corrigir sync/manual, garantir atualização real dos Insights, melhorar detalhe de votos por projeto, adicionar agenda ao vivo Câmara/Senado e entregar um plano de testes ponta a ponta.

1) Diagnóstico (com base no código + reprodução)
- Reproduzi o problema do botão de sync: ele entra em “Sincronizando...” e depois retorna erro genérico “Failed to send a request to the Edge Function”.
- Mesmo quando falha, a cota de 10 min é consumida (porque `sync_logs` é gravado no início da execução).
- Em Insights, o detalhe de projeto já tenta listar votos individuais, mas depende de joins por `analises_*` (pode faltar nome/partido em alguns casos e ficar “Dep./Sen. ID”).
- Não existe painel de progresso/log em tempo real para sync.
- Não há área de agenda/votação ao vivo ainda.

2) Correções de sync (automático + manual com autenticação)
- Criar tabela `sync_runs` (status, casa, ano, user_id nullable p/ automático, started_at, finished_at, error, summary_json).
- Criar tabela `sync_run_events` (run_id, step, message, created_at) para logs incrementais visíveis na UI.
- Atualizar `sync-camara` e `sync-senado`:
  - registrar `sync_runs` no início;
  - gravar eventos por etapa (download, upsert metadados, votos, análises);
  - só inserir em `sync_logs` ao final com sucesso (não penalizar falha);
  - retornar `run_id` + resumo final.
- Ajustar UX do botão:
  - estado “em execução” com timeline de logs;
  - polling dos logs enquanto roda;
  - refetch automático ao concluir (analises + votações + insights).

3) Correções no detalhe de projetos (nome, partido, voto)
- No sync, salvar dados denormalizados em `votos_deputados` e `votos_senadores` (nome, partido, UF, foto) para não depender de join com `analises`.
- Em `ProjetosTab`, buscar votos paginados (não limitar a 500/1000 fixo) e exibir sempre nome/partido/voto.
- Melhorar busca interna do modal (nome, partido, UF, voto literal e normalizado).

4) Insights + mapa (filtro real por UF e blocos)
- Elevar estado de UF selecionada para `Insights.tsx`.
- Fazer o `BrazilMap` emitir `onSelectUf`.
- Aplicar filtro UF nos datasets de Visão Geral/Partidos/Divergência/Projetos.
- Adicionar contadores por UF de Governo/Centro/Oposição no painel lateral do mapa.

5) Agenda ao vivo e “votando agora”
- Nova aba “Ao Vivo” em Insights.
- Criar função backend `agenda-live` para consolidar agenda/plenário de Câmara e Senado e classificar:
  - “em andamento agora”,
  - “próximas votações”,
  - “últimas atualizações”.
- Persistir em `agenda_live_items` (cache curto) + atualização automática (cron curto, ex. a cada 2-5 min).
- Frontend com polling curto e carimbo “atualizado há Xs”.

6) Endpoint para uso externo (robustez)
- Manter `api-dados`, mas corrigir UX em Perfil:
  - trocar `useState(() => fetchApiKeys())` por `useEffect`;
  - mostrar URL completa copiável;
  - exemplo pronto por casa/ano/tipo.
- Endurecimento: exibir chave só na criação (mascarada na lista), com rotação/revogação.

7) Migrações e segurança (RLS)
- Novas tabelas: `sync_runs`, `sync_run_events`, `agenda_live_items` (+ índices por casa/ano/status/created_at).
- RLS:
  - `sync_runs`/`sync_run_events`: usuário autenticado vê apenas os próprios runs; execução automática registrada sem exposição indevida.
  - `agenda_live_items`: leitura pública (dados legislativos não sensíveis).
- Sem mexer em arquivos auto-gerados de cliente/tipos manualmente.

8) Plano de teste ponta a ponta (checklist)
- Câmara:
  - login → clicar sync → ver logs em tempo real → conclusão sem erro;
  - confirmar atualização de cards/ranking/insights;
  - repetir antes de 10 min e validar bloqueio correto.
- Senado: mesmo fluxo.
- Insights > Projetos:
  - abrir projeto e validar votos individuais com nome/partido/UF/voto;
  - busca por número (ex: “PL 1234”) e por nome no modal.
- Insights > Estados:
  - selecionar UF e confirmar que demais blocos filtram.
- Insights > Ao Vivo:
  - validar sessões “em andamento agora” e lista de projetos votados no momento.
- Perfil/API:
  - gerar chave, copiar endpoint, testar chamada externa com resposta paginada.
