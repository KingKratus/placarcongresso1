
## Resumo

Quatro entregas independentes:

1. **Sync manual de Emendas $ no Perfil** (com varredura automática de anos disponíveis).
2. **UX da aba "Meu Partido"** (mais claro, navegável, com seções colapsáveis e CTAs).
3. **Sync histórico 2019-2022** (Bolsonaro vs. Lula) para Câmara, Senado e Emendas.
4. **Mapa de Estados** com cores explícitas por classificação política (Governo / Centro / Oposição) em vez de só gradiente por score.

---

## 1. Sync de Emendas $ no Perfil

### UI
- Novo card "Sincronizar Emendas Orçamentárias" em `src/pages/Perfil.tsx`, visível apenas para usuários autenticados (idealmente `has_role('admin')`, mas com fallback aberto se o usuário tiver `partido_filiacao` — escolho **somente admin** para preservar quota).
- Botão **"Varrer todos os anos disponíveis"**: dispara loop de 2014 → ano corrente, parando quando 3 anos consecutivos retornarem 0 registros (sinal de que o Portal não publicou mais nada).
- Botão **"Sincronizar ano específico"** com `Select` (2014-2026).
- Mostra progresso ano-a-ano (ano corrente + nº inserido + `empty_reason`) e quota diária restante via `usePortalQuota`.

### Edge Function
- Novo modo `varredura: true` em `sync-emendas-transparencia/index.ts`:
  - Itera anos `[anoInicio..anoFim]` (default 2014..ano atual).
  - Para cada ano, executa o fluxo já existente; respeita `checkAndIncQuota` (interrompe se quota acabar e devolve `{ stoppedAt, reason: "quota" }`).
  - Acumula `summary[]` por ano: `{ ano, fetched, inserted, empty_reason }`.
  - Aborta ciclo após `consecutiveEmptyYears >= 3`.
- Cliente chama em loop ano-a-ano (não em uma só request) para feedback incremental e para evitar timeout do edge runtime; usa `sync_runs` + `sync_run_events` já existentes para log.

---

## 2. UX da aba "Meu Partido" (`PartidoInsightsTab.tsx`)

Problemas atuais: tudo num scroll só, filiação confusa, sem hierarquia visual.

Mudanças:
- **Header sticky** com `Avatar` do partido (logo placeholder), nome, bancada (Gov/Centro/Opo), nº de parlamentares e score médio em destaque (Big Number).
- **Auto-detect** do partido: se usuário tem `partido_filiacao` salvo, abre direto; caso contrário, mostra estado vazio com `Select` + botão "Salvar filiação".
- **Tabs internas**: `Visão Geral` · `Membros` · `Dissidentes` · `Temas` · `Comparar com Gov/Opo`.
  - **Membros** subdivididos por bloco (Governo/Centro/Oposição) com `Accordion` colapsável e contagem em badge — facilita mobilização (já existia, virar accordion).
  - **Dissidentes** com card expandido (motivo da dissidência, link p/ perfil, botão "Contatar").
  - **Temas**: gráfico de distribuição já existente, mais lista de "temas onde o partido mais se afasta da liderança".
  - **Comparar**: mini-comparação score do partido vs. média Governo / Centro / Oposição (3 barras).
- **Empty states** desenhados (ícone + texto + CTA) para `sem filiação`, `sem dados no ano`, `partido sem votos`.
- **Mobile-first**: cards em grid 1-col no <640px, CTAs full-width, navegação por chips.

Arquivos: `src/components/insights/PartidoInsightsTab.tsx` (refactor), pequeno helper novo `src/components/insights/PartidoHeader.tsx`.

---

## 3. Sync histórico 2019-2022 (Bolsonaro × Lula)

Hoje os anos só vão até onde foi sincronizado. Para comparar governos, precisamos garantir cobertura 2019-2026.

### Ações
- Adicionar botão **"Sincronizar histórico 2019-2022"** em `src/pages/Admin.tsx` (ao lado dos sync atuais), que dispara em sequência:
  - `sync-camara` para cada ano 2019..2022.
  - `sync-senado` para cada ano 2019..2022.
  - `classify-votacoes` (reaproveita lógica existente).
  - `sync-emendas-transparencia` em modo `varredura` 2019..2022.
- Mostra progresso via `SyncLogViewer` existente.
- Adicionar **comparador "Era Bolsonaro (2019-2022) vs Era Lula (2023-2026)"** na aba Tendências (`CentroTrendsCamara` e `CentroTrendsSenado`):
  - Toggle "Comparar Governos" mostra duas linhas/áreas agregadas em vez do histórico anual.
  - Reaproveita `analises_deputados` / `analises_senadores` filtrando por intervalo.

Nenhuma migration nova — só sync de dados em tabelas já existentes.

---

## 4. Mapa de Estados — cores por classificação

Em `src/components/insights/BrazilMap.tsx`, hoje `getColor(val)` mapeia por threshold de score, mas a UI atual ainda confunde por usar a mesma escala em hover/legend. Mudanças:

- Renomear `getColor` para tomar **classificação calculada** como input principal (`Governo`/`Centro`/`Oposição`/`Sem Dados`) e cair para o threshold de score só como fallback.
- **Paleta explícita** (alinhada com o resto do app):
  - Governo: `hsl(160 84% 39%)` (verde)
  - Centro: `hsl(239 84% 67%)` (azul/índigo)
  - Oposição: `hsl(347 77% 50%)` (vermelho)
  - Sem Dados: `hsl(var(--muted))`
- **Pré-calcular classificação por UF** no `Insights.tsx` (já existe `ufData`, adicionar `camaraClass`/`senadoClass` de fato — campos existem na interface mas não estão sendo populados; popular agregando `classificacao` modal por UF dos `analises_*`).
- Legenda passa a refletir contagem por classificação por casa selecionada (já tem, validar coerência).
- Tooltip: mostra "Classificação predominante" + score médio.
- Aplicar mesma paleta no painel lateral e na lista "Todos os Estados".

---

## Detalhes técnicos

### Arquivos editados
- `supabase/functions/sync-emendas-transparencia/index.ts` — novo modo `varredura` e `empty_reason` por ano.
- `src/pages/Perfil.tsx` — card "Sincronizar Emendas" (admin-gated).
- `src/pages/Admin.tsx` — botão "Sync histórico 2019-2022".
- `src/components/insights/PartidoInsightsTab.tsx` — refactor de UX (tabs internas + accordions + header).
- `src/components/insights/PartidoHeader.tsx` — novo componente.
- `src/components/insights/BrazilMap.tsx` — paleta por classificação + cálculo no Insights.
- `src/pages/Insights.tsx` — popular `camaraClass`/`senadoClass` no `ufData`.
- `src/components/CentroTrendsCamara.tsx` / `CentroTrendsSenado.tsx` — toggle "Comparar Governos (2019-22 × 2023-26)".

### Loop de varredura (cliente)
```ts
for (let ano = 2014; ano <= currentYear; ano++) {
  const r = await supabase.functions.invoke("sync-emendas-transparencia", {
    body: { ano, paginas: 5, varredura: false },
  });
  setProgress({ ano, ...r.data });
  if (r.data?.fetched === 0) emptyStreak++; else emptyStreak = 0;
  if (emptyStreak >= 3) break;
  if (r.data?.quota?.remaining < 5) break;
}
```

### Cores no mapa
```ts
const PALETTE = {
  Governo: "hsl(160 84% 39%)",
  Centro: "hsl(239 84% 67%)",
  Oposição: "hsl(347 77% 50%)",
  "Sem Dados": "hsl(var(--muted))",
};
function colorFor(classification: string) { return PALETTE[classification] ?? PALETTE["Sem Dados"]; }
```

### Sem migrations
Toda a entrega usa as tabelas existentes (`emendas_orcamentarias_transparencia`, `sync_runs`, `analises_*`, `profiles.partido_filiacao`).
