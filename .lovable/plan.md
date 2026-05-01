## Escopo

Tudo abaixo será implementado em uma única passada após aprovação.

---

### 1. Aba "Meu Partido" — finalização

Arquivo: `src/components/insights/PartidoInsightsTab.tsx`

- Salvar partido de filiação no `profiles.partido_filiacao` já existe — adicionar:
  - Auto-seleção do partido salvo ao abrir a aba.
  - Seção **"Dissidentes"** já presente — manter, mas adicionar CTA "Ver perfil" (link `/deputado/:id` ou `/senador/:id`).
  - Nova seção **"Distribuição por Tema"**: agrupa votos do partido por tema (via `votacao_temas` + `votos_deputados/senadores`) mostrando % alinhado/contrário do partido em cada tema no ano selecionado. Gráfico horizontal de barras empilhadas (favor/contra/abstenção).
  - Card "Posição esperada vs real" comparando média do partido com a faixa esperada da bancada (Gov 70-100, Centro 35-70, Opo 0-35).
  - Insights individuais **separados por bloco**: lista de parlamentares do partido segmentados em "Atuando como Governo / Centro / Oposição" baseado no `classificacao` individual — para mobilização do filiado entender quem é dissidente.

---

### 2. Toggle Tradicional/IA na aba Comparar

Arquivo: `src/components/insights/ComparacaoParlamentaresTab.tsx`

- Adicionar toggle (Tradicional | IA) no topo do card.
- Quando IA ativo:
  - Buscar score IA da tabela `analises_ponderadas` (campo `score_ia`) por `parlamentar_id + casa + ano`. Se inexistente, usa `score_tradicional`.
  - Recalcula "Bancada esperada × real" usando o score IA.
  - Margens da zona neutra reduzidas (proporcional ao `confianca_ia`).
- Adicionar **card "Metodologia"** expansível explicando:
  - Tradicional: % de votos alinhados com líder do governo.
  - IA: `Σ(voto_alinhado × confianca_tema × peso_tipo_proposicao) / Σ(pesos)`. Pesos: PEC=1.5, PLP=1.2, PL=1.0, MPV=1.3, outros=0.7. Confiança vem da classificação temática IA.
  - Limiares de bancada esperada e como o desvio é calculado.

---

### 3. Insights individuais por partido na aba Comparar

Arquivo: `src/components/insights/ComparacaoParlamentaresTab.tsx`

Quando o usuário escolhe um parlamentar, adicionar abaixo do MiniProfile um novo card **"Detalhamento do Partido"**:

- Lista todos os colegas do mesmo partido **separados em três blocos**: Governo / Centro / Oposição (baseado em `classificacao`).
- Cada parlamentar é clicável (vai ao perfil).
- Mostra média de cada bloco e contagem.
- Indica se o parlamentar selecionado está **alinhado** ou **dissidente** em relação à média do bloco majoritário do partido.
- Útil para o filiado mobilizar dissidentes.

---

### 4. Aba "Alertas"

Nova aba no `src/pages/Insights.tsx` + novo componente `src/components/insights/AlertasTab.tsx`.

Detecta automaticamente eventos alarmantes:

- **Migrações abruptas**: parlamentares que mudaram de classificação (Gov ↔ Opo) entre o ano anterior e atual com delta > 20pp.
- **Dissidência extrema**: parlamentares cujo score difere > 25pp da média do próprio partido.
- **Emendas com risco Alto e valor > R$ 5M** (de `emendas_orcamentarias_transparencia`).
- **Quota Portal Transparência > 80%** (alerta operacional para admin).
- **Sync com erro nas últimas 24h** (`sync_runs.status = 'error'`).
- **Proposições prioritárias travadas** (sem evento há > 90 dias) — usa `tramitacoes_cache.ultima_atualizacao`.

Cada alerta tem severidade (info/warning/danger), botão para abrir o item e timestamp. Filtro por severidade e tipo.

---

### 5. Bloco "Alertas Recentes" na aba Tendências

Em `src/components/CentroTrendsCamara.tsx` e `src/components/CentroTrendsSenado.tsx`, no topo da migração entre anos, adicionar pequeno card "Movimentações alarmantes detectadas (delta > 20pp)" listando até 5 casos.

---

### 6. Toggle Tradicional/IA em CentroTrendsSenado

Arquivo: `src/components/CentroTrendsSenado.tsx`

- Replicar lógica do `CentroTrendsCamara.tsx`: state `weightMode`, função `getTendency(score, mode)` com margem 1.5 (IA) vs 3 (tradicional), botão toggle no header.
- Atualizar `leanGov/leanOpo/neutro/chartData` para usar `weightMode`.

---

### 7. Fix Base do Governo — tela troca de método mas continua mostrando alinhamento com líder

Arquivos: `src/pages/Index.tsx`, `src/pages/Senado.tsx`, `src/components/StatsPanel.tsx`, `src/components/StatsPanelSenado.tsx`, `src/components/ComparisonView.tsx`, `src/components/ComparisonViewSenado.tsx`.

**Problema**: o select "Líder do Governo / Média Partido Gov / Bancada" só altera o `govMethod` local mas as `analises_*` no banco têm score calculado com líder do governo. Os cards mostram sempre o mesmo número.

**Solução**:

- Criar um `useMemo` que recalcula score conforme método:
  - `lider`: usa `analise.score` (default).
  - `partido-gov`: para cada parlamentar, score = % de votos coincidentes com a moda do partido governista (PT) — calcula client-side com base nos `votos_deputados/senadores` cacheados ou na `analises_*` do partido governista.
  - `bancada`: usa orientações de bancada do partido do parlamentar.
- Re-deriva `classificacao` (Gov/Centro/Opo) com base nesse novo score e passa o array recalculado para `ComparisonView`/`ComparisonViewSenado`.
- Como cálculo voto-a-voto pode ser pesado, usar abordagem simples e correta: para `partido-gov`, calcular a média do partido governista (PT) e exibir o **delta de cada parlamentar vs essa média**, classificando: |delta| ≤ 10 = Governo, ≤ 25 = Centro, > 25 = Oposição. Tornar o método **realmente visível** alterando os números.
- Atualizar o texto da metodologia para refletir o método ativo.

---

### 8. Fix Projetos — votos zerados no front

Arquivo: `src/components/insights/ProjetosTab.tsx`, função `openProjectDetail`.

**Problema**: para Senado, quando `votos_senadores` está vazio para a votação, `individualVotes` fica vazio e o breakdown vai zerado. Para Câmara já há fallback à API; falta para Senado e falta também tratamento quando `analises_*` não tem todos os parlamentares (fallback usa só nome do voto).

**Solução**:

- Câmara: atual `fetchCamaraApiVotes` ok; garantir que `voto` venha de `tipoVoto` corretamente (alguns retornos da API usam `tipoVoto`/`voto`). Fallback adicional: tentar `https://dadosabertos.camara.leg.br/api/v2/votacoes/{id}` se `/votos` vier vazio.
- Senado: criar `fetchSenadoApiVotes(codigo)` chamando `https://legis.senado.leg.br/dadosabertos/plenario/votacao/{codigo}.json`, parse de `Votacao.Votos.VotoParlamentar[]` (campos `CodigoParlamentar`, `NomeParlamentar`, `SiglaPartido`, `SiglaUF`, `DescricaoVoto`).
- Se DB vazio → busca API; se DB tem votos mas analises não tem o parlamentar (faltando nome/partido) → tentar API para enriquecer.
- Adicionar log no console e mensagem amigável "Sem dados de voto disponíveis no momento" quando ambas as fontes falharem.

---

### 9. Sync Emendas $ — diagnóstico e fix

**Diagnóstico já realizado**: o Portal da Transparência retorna **0 registros** para os anos 2025/2026 (executado em 30/abr/2026: 0 registros nas 3 páginas). Anos 2022/2023 retornam dados. O sync **não está quebrado**: o Portal simplesmente ainda não publicou as emendas executadas desses anos novos (delay típico de orçamento federal).

**Solução**:

- Em `supabase/functions/sync-emendas-transparencia/index.ts`:
  - Quando todas as páginas retornarem 0 registros, gravar `summary.empty_reason = "Portal sem dados publicados para o ano X"` e o status volta `completed` mas com flag.
  - Tentar fallback: ao detectar 0 registros para o ano solicitado, automaticamente tentar `ano - 1` se nenhum filtro de autor estiver setado, marcando no log.
  - Adicionar parâmetro opcional `tentarAnoAnterior: boolean` (default `true`).
- Em `src/components/insights/EmendasOrcamentariasTab.tsx` e nos botões de sync (Admin, perfil): mostrar aviso amarelo quando `summary.empty_reason` estiver presente, com texto: "O Portal ainda não publicou emendas executadas para {ano}. Tente {ano-1} ou aguarde a próxima atualização do governo."
- Adicionar no painel admin um sub-painel **"Status do Portal por ano"** mostrando quantas emendas existem em `emendas_orcamentarias_transparencia` por ano.

---

### 10. Memória

Atualizar `mem://logic/alignment-calculation-rules` com a fórmula IA ponderada (PEC=1.5, etc.) e o método "partido-gov" como média do partido governista.

---

## Arquivos modificados

- `src/components/insights/PartidoInsightsTab.tsx` (extensão)
- `src/components/insights/ComparacaoParlamentaresTab.tsx` (toggle IA, metodologia, blocos por partido)
- `src/components/insights/AlertasTab.tsx` (novo)
- `src/pages/Insights.tsx` (nova aba Alertas)
- `src/components/CentroTrendsSenado.tsx` (toggle IA)
- `src/components/CentroTrendsCamara.tsx` (alertas no topo da migração)
- `src/components/ComparisonView.tsx` + `ComparisonViewSenado.tsx` (recalcular por método)
- `src/components/StatsPanel.tsx` + `StatsPanelSenado.tsx` (passar método derivado)
- `src/pages/Index.tsx` + `src/pages/Senado.tsx` (passar govMethod até ComparisonView)
- `src/components/insights/ProjetosTab.tsx` (fallback API Senado, melhor handling Câmara)
- `src/components/insights/EmendasOrcamentariasTab.tsx` (aviso de "ano sem dados")
- `src/pages/Admin.tsx` (status do Portal por ano)
- `supabase/functions/sync-emendas-transparencia/index.ts` (empty_reason + fallback ano anterior)
- `mem://logic/alignment-calculation-rules` (atualização)

Sem migrations de schema necessárias.

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Detecção de viradas

&nbsp;

Alerta automático de parlamentares com mudança >20pp entre anos.

Alerta de voto atípico

&nbsp;

Notifica quando um parlamentar diverge do partido em 3+ votações seguidas.