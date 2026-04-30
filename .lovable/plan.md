## Objetivo

Tornar o sync de Emendas $ resiliente a limites diários do Portal da Transparência, melhorar a aba Comparar com viés partidário (Gov/Centro/Oposição), criar ferramentas de insight para filiados, badges temáticas dos parlamentares, cache de execução com anti-duplicação, ponderação tradicional vs IA na aba Tendências e melhorias de observabilidade.

## 1. Sync com rate-limit diário (Portal da Transparência)

O Portal limita ~700 req/dia/chave. Hoje o cron horário pode estourar. Vou implementar um **orçamento diário** persistido + adaptação.

**Backend** (`sync-emendas-transparencia` + nova tabela `portal_api_quota`):

- Nova tabela `portal_api_quota (date, requests_used, daily_limit default 600, updated_at)` — única linha por dia.
- Antes de cada `fetchPortal()`, incrementa contador via UPSERT atômico; se `requests_used >= daily_limit`, aborta com erro amigável `"Limite diário do Portal atingido (X/Y). Tente após 00:00."` e marca o run como `error` com `step: "rate_limit"`.
- **Adaptive paging**: ao detectar latência > 5s em uma página, reduz `paginas` restantes pela metade e loga `step: "adaptive"` ("Reduzindo páginas por lentidão"). Substitui o timeout fixo de 8s por timeout escalonado (10s → 15s → 25s) com retry.
- **Cron de emendas removido**. O sync de emendas passa a ser **apenas manual** (admin) via UI. Câmara/Senado mantêm cron, mas **emendas $ não consomem cota automaticamente**.

**Migration**:

- Cria `portal_api_quota` (RLS: select público, write apenas service_role).
- Não toca em `sync-camara`/`sync-senado` (não usam Portal).

## 2. Sync manual de Emendas $ no Admin (já existe — reforçar)

Já há um card no Admin. Vou:

- Adicionar **selector de tipo (PIX/Individual/Bancada/Comissão/Relator)** + **input de autor** opcional.
- Mostrar "**Cota do Portal hoje: X/Y**" puxado de `portal_api_quota`.
- Substituir progress por `<SyncLogViewer>` real (via `useSyncRun`) em vez do timer fake.
- Botão "Tentar novamente" aparece quando o último run falhou — reusa último payload.

## 3. Cache de execução + anti-duplicação

Nova tabela `sync_query_cache`:

- Colunas: `id, cache_key (text unique), endpoint, params (jsonb), response (jsonb), created_at, expires_at, hit_count`.
- TTL padrão 6h para listagens, 24h para `documentos`.
- `fetchPortal()` calcula `cache_key = sha256(endpoint + params)`; se hit válido → retorna do cache, **não consome cota**, loga `step: "cache_hit"` ("Cache: pulou requisição X").
- Upsert em **lotes de 100** (já é) com `onConflict: "codigo_emenda"` — anti-duplicação preservada e reforçada por `Map` em memória antes do upsert.
- **Painel Admin**: novo card "Cache de Sync" mostrando totais (hits/miss últimas 24h, % economia, quota usada). Eventos do log que tenham `step: "cache_hit"` recebem badge azul "CACHE" no `SyncLogViewer`.

## 4. Modal de erro com retry contextual

`SyncLogViewer` ganha:

- Quando `status === "error"`, exibe banner com a `error` (já vem de `sync_runs.error`) + botão **"Tentar novamente"** que reinvoca a função com o mesmo payload (passado por prop `onRetry`).
- Identifica erros conhecidos: timeout do Portal, rate limit, JSON inválido — cada um com ação sugerida ("Aguardar X min", "Reduzir páginas", "Ver cota").
- Aplicado em: `EmendasOrcamentariasTab` (modal de validação), `Admin` (card de sync), `EmendasFinanceirasParlamentar` (perfil).

## 5. Aba Comparar — bloco partidário Gov/Centro/Oposição

Em `ComparacaoParlamentaresTab.tsx`, adicionar **terceira coluna** abaixo dos dois MiniProfile:

- **Card "Esperado vs Real"** por parlamentar:
  - Lê `getBancada(partido)` de `src/lib/bancadas.ts` → "Base Gov" (esperado ≥70%), "Oposição" (≤35%), "Independente" (35-70%).
  - Compara com `score` real → mostra delta colorido + label "Alinhado ao esperado", "Mais governista que o partido", "Dissidente".
- **Card "Coerência partidária"**: agrega média do partido no ano e mostra desvio do parlamentar vs partido (pp).
- Novo gráfico de barras lado-a-lado: score real vs média do partido vs faixa esperada.

## 6. Ferramentas para filiados/apoiadores

Nova aba **"Meu Partido"** em Insights (`PartidoInsightsTab.tsx`):

- Selector de partido (preenchido por padrão se usuário tiver partido salvo no perfil — adicionar `partido_filiacao` em `profiles`).
- Métricas: ranking interno, dissidentes top-5, alinhamento médio, evolução anual, temas onde o partido mais vota a favor/contra.
- "Radar de coerência": top dissidentes (parlamentares com maior delta vs média do partido).
- Botão "Acompanhar este partido" — salva preferência e habilita notificações futuras (placeholder).
- Export CSV/PDF do relatório do partido.

## 7. Badges temáticas por parlamentar

Função utilitária + view materializada `parlamentar_badges_tema`:

- Para cada parlamentar/ano, agrega votos por `votacao_temas.tema` (já existe).
- Se ≥70% dos votos em um tema foram "Sim" → badge **"Pró-{tema}"**; ≥70% "Não" → **"Anti-{tema}"**; senão sem badge para esse tema.
- Limita a top 3 badges mais expressivos.
- Renderiza em `DeputyCard`, `SenadorCard`, `MiniProfile` da aba Comparar e nos detalhes (`DeputadoDetail`/`SenadorDetail`).
- Migration cria a view + função `get_parlamentar_badges(_id, _casa, _ano)`.

## 8. Aba Tendências — Ponderação Tradicional vs IA

Em `CentroTrendsCamara.tsx` e `CentroTrendsSenado.tsx`:

- Toggle no topo: **"Ponderação: [Tradicional] [IA]"**.
- **Tradicional** (atual): conta voto cru = orientação do governo.
- **IA**: novo edge function `weight-votes-ia` que pondera cada votação por `votacao_temas.confianca` × peso de impacto (PEC=1.5, MP=1.3, PL=1.0, REQ=0.5) já classificado por IA. Resultado salvo em nova tabela `analises_ponderadas (parlamentar_id, casa, ano, score_ia, components jsonb)` — recalculado on-demand por ano.
- Gráfico exibe ambas as curvas quando o toggle estiver em "Comparar".
- Tooltip explica a diferença ao passar o mouse no toggle.

## 9. Sugestões de novas features

Novo componente `FeatureSuggestionsPanel` exibido em **Tendências** e **Visão Geral**:

- "Heatmap mensal": calor de alinhamento por mês × partido.
- "Detecção de viradas": parlamentares que mudaram >20pp entre dois anos.
- "Alerta de votação atípica": parlamentar que votou contra a média do partido em 3+ votações seguidas.
- "Comparador histórico de governos": agrega scores médios por mandato presidencial.
- "Ranking de produtividade": cruza proposições autorais × emendas pagas × presença.
- Cada cartão tem botão "Sugerir" (telemetria simples) e "Implementar" (link para abrir uma issue interna — registrar em nova tabela `feature_suggestions`).

## Arquivos afetados

**Novos**:

- `supabase/migrations/<ts>_portal_quota_cache_badges.sql` (4 tabelas + view + funções)
- `supabase/functions/weight-votes-ia/index.ts`
- `src/components/insights/PartidoInsightsTab.tsx`
- `src/components/insights/FeatureSuggestionsPanel.tsx`
- `src/components/ParlamentarBadgesTema.tsx`
- `src/lib/portalCache.ts` (helpers de cache)
- `src/hooks/usePortalQuota.ts`

**Editados**:

- `supabase/functions/sync-emendas-transparencia/index.ts` (cache, quota, adaptive)
- `supabase/migrations/...` adicional para remover cron de emendas (se houver)
- `src/components/SyncLogViewer.tsx` (retry button + error parsing + badge cache)
- `src/hooks/useSyncRun.ts` (suporte a onRetry)
- `src/pages/Admin.tsx` (card de quota + cache)
- `src/pages/Insights.tsx` (nova aba "Meu Partido")
- `src/components/insights/ComparacaoParlamentaresTab.tsx` (bloco bancada)
- `src/components/insights/EmendasOrcamentariasTab.tsx` (retry no modal)
- `src/components/CentroTrendsCamara.tsx` + `CentroTrendsSenado.tsx` (toggle Trad/IA)
- `src/components/DeputyCard.tsx` + `SenadorCard.tsx` (badges temáticas)
- `src/components/insights/EmendasFinanceirasParlamentar.tsx` (retry)

## Detalhes técnicos

```text
sync-emendas-transparencia
  ├── checkQuota() → portal_api_quota (UPSERT atômico)
  ├── fetchPortal()
  │     ├── cacheLookup(key) → sync_query_cache (TTL)
  │     ├── if hit: log "cache_hit", return
  │     ├── else: fetch (timeout escalonado), incQuota
  │     └── cacheStore(key, response)
  ├── adaptivePaging (latency > 5s → halve)
  └── on error: sync_runs.error + step "rate_limit"|"timeout"
```

```text
weight-votes-ia (novo)
  Input: { ano, casa }
  → Lê votos + votacao_temas + tipo proposição
  → score = Σ(voto_alinhado × confianca_ia × peso_tipo) / Σ(confianca × peso)
  → Upsert em analises_ponderadas
```

## Pontos de atenção

- Cron de emendas é removido para respeitar cota — Câmara/Senado seguem horários (não usam Portal).
- Badges temáticas requerem `votacao_temas` populado; já existe pipeline `classify-votacoes`.
- `analises_ponderadas` é opcional (só preenche quando usuário ativa toggle IA).
- Cache anti-duplicação usa `Map` em memória + `onConflict` no upsert — sem risco de dupes.

&nbsp;

Scan vulnerabilidades e bugs. Otimize código. 

Aba Ao Vivo servir para o Senado também. 