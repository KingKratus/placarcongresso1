The user wants a comprehensive parliamentary performance score system with 4 dimensions (Alignment, Presence, Impact, Engagement), customizable weights, and the ability to reset to defaults. Let me plan this concisely.

Existing infrastructure: alignment (A) is already calculated via `analises_deputados.score`. Need to add P, I, E from new API endpoints.

## Plano: Score de Desempenho Parlamentar (P-Score)

### 1. Nova Tabela: `deputy_performance_scores`

Armazena as 4 dimensões + score final por deputado/ano:

- `deputado_id`, `ano`, `casa`
- `score_alinhamento` (A) — vem de `analises_deputados.score`
- `score_presenca` (P) — % presença em sessões
- `score_impacto` (I) — peso(tipo) × status × abrangência das proposições
- `score_engajamento` (E) — comissões + relatorias
- `score_total` (P normalizado 0-100)
- `dados_brutos` (jsonb — sessoes_total, sessoes_presente, relatorias, etc.)

RLS: leitura pública, escrita só service role.

### 2. Nova Edge Function: `calculate-performance`

Batch para todos os 513 deputados (e senadores em fase 2):

- Busca presença: `GET /deputados/{id}/eventos` + cruzar com `/eventos/{id}/votantes`
- Busca proposições: já temos em `proposicoes_parlamentares` (adicionar campos `status_tramitacao` e `peso_tipo`)
- Busca comissões: `GET /deputados/{id}/orgaos` + `/orgaos/{id}/eventos`
- Aplica fórmulas com pesos padrão
- Normaliza P_final (0-100) usando min-max do conjunto
- Cron diário via pg_cron (1x/dia, 03:00 UTC)

### 3. Atualizar `fetch-proposicoes` (enriquecer)

Adicionar à tabela `proposicoes_parlamentares`:

- `status_tramitacao` (Aprovada/Em tramitação/Arquivada)
- `peso_tipo` calculado (PEC=1.0, PL=0.6, PDL=0.4, REQ=0.1)
- Usar tema já classificado para `abrangencia_tema`

### 4. UI: Nova Aba "Desempenho" no Perfil

`DeputadoDetail.tsx` e `SenadorDetail.tsx` gan

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Scan bugs also