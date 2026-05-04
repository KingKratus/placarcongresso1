
## Resumo

Cinco entregas focadas em comparar governos Bolsonaro × Lula e melhorar o mapa.

1. **Expor 2019-2022 no frontend** (selectors + queries).
2. **Sync manual de 2020-2022** (Câmara + Senado) — 2019 já existe no banco; 2020-2022 estão zerados.
3. **Mapa: escala tonal por cor + tooltip rico** com classificação, % e ano/recorte.
4. **Aba "Meu Partido": seção comparativa Bolsonaro (2019-22) × Lula (2023-26)** com gráficos e variação percentual.
5. **Comparador temático Lula × Bolsonaro** (economia, social, segurança, etc.) reaproveitando `votacao_temas`.

---

## 1. Expor 2019-2022 no frontend

Hoje `ANOS` em `src/pages/Insights.tsx` começa em 2023, e `ALL_YEARS` em `src/hooks/useInsightsData.ts` está fixo `[2023..2026]`. Por isso 2019 (que já está no banco) some.

- `Insights.tsx`: `const ANOS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]` (filtrado até `currentYear`).
- `useInsightsData.ts`: `ALL_YEARS = [2019..currentYear]` para alimentar `AlignmentTrendChart`, `AlignmentSimulation` e o novo comparador.
- `Index.tsx` e `Senado.tsx`: idem nos seletores de ano (verificar `ANOS` local).
- `CentroTrendsCamara/Senado`: aceitar dados pré-2023 no toggle "Comparar Governos" já existente.

## 2. Sync de 2020-2022

Estado atual no banco:
- `analises_deputados`: 2019 ✅, 2020-2022 ❌, 2023-2026 ✅
- `analises_senadores`: idem

Plano:
- Ampliar `AVAILABLE_YEARS` em `AdminBulkSync.tsx` para iniciar em **2014** (cobrir gov. Dilma também) — já abrange 2019+ hoje.
- Disparar `sync-camara` + `sync-senado` para 2020, 2021, 2022 via UI Admin (preset "Era Bolsonaro" já existe — ele vai rodar todos os 4 anos; 2019 vai re-sincronizar idempotente).
- Após sync, rodar `classify-votacoes` para popular `votacao_temas` desses anos (necessário para o comparador temático).

Não há mudanças de schema.

## 3. Mapa: escala tonal + tooltip

**Problema reportado**: a paleta atual pintou estados que deveriam ser azuis (Centro) de verde (Governo) porque `getColor` cai no fallback de threshold quando `classificacao` está faltando. Além disso, o usuário quer **variação tonal dentro da cor**, não 3 cores chapadas.

Mudanças em `src/components/insights/BrazilMap.tsx`:

- **Escala HSL com lightness modulada pela %**:
  ```ts
  // Governo (verde): 70-100% → lightness 50% → 25%
  // Centro (azul):  35-70%  → lightness 65% → 40%
  // Oposição (vermelho): 0-35% → lightness 65% → 40%
  function tonalColor(val: number | null): string {
    if (val === null) return "hsl(var(--muted))";
    if (val >= 70) {
      const t = (val - 70) / 30;            // 0..1
      const l = 50 - t * 25;                // mais alinhado = mais escuro
      return `hsl(160, 84%, ${l}%)`;
    }
    if (val >= 35) {
      const t = (val - 35) / 35;
      const l = 65 - t * 25;
      return `hsl(239, 84%, ${l}%)`;
    }
    const t = (35 - val) / 35;              // mais oposto = mais escuro
    const l = 65 - t * 25;
    return `hsl(347, 77%, ${l}%)`;
  }
  ```
- Remover o fallback que misturava classificação ausente com threshold (causa do "verde indevido"). Agora a cor sai sempre da % real; a classificação só serve para legenda/tooltip.

- **Tooltip nativo SVG** (HoverCard ou `<title>` + overlay flutuante):
  - Implementar com `@radix-ui/react-hover-card` envolvendo cada `<path>`.
  - Conteúdo:
    ```
    Estado: SP
    Câmara — Centro · 58%
    Senado — Governo · 74%
    Recorte: 2025 (Câmara + Senado)
    ```
  - Receber `ano` via prop em `<BrazilMap ano={ano} />` e exibir.
  - Toque em mobile: `onTouchStart` mostra tooltip por 3s antes de selecionar.

- Legenda passa a mostrar **gradiente** (faixa horizontal) por bloco em vez de quadradinho fixo, deixando claro que há intensidade.

## 4. "Meu Partido": comparador 2019-22 × 2023-26

Refactor leve em `src/components/insights/PartidoInsightsTab.tsx`:

- Nova aba interna **"Bolsonaro × Lula"** (ao lado de Visão Geral / Membros / Dissidentes / Temas / Ranking).
- Usa `allYearsDeputados`/`allYearsSenadores` filtrado por `partido === filiacao`.
- Conteúdo:
  - **Big numbers**: Score médio Bolsonaro (média 2019-2022) × Lula (média 2023-2026) + Δ percentual.
  - **Distribuição de classificações**: barras empilhadas Gov/Centro/Opo por era.
  - **Linha do tempo anual**: line chart com pontos por ano, duas zonas sombreadas (azul claro 2019-22, amarelo claro 2023-26).
  - **Top dissidentes da era Lula** (parlamentares cujo score caiu/subiu mais entre eras).
- Empty state quando o partido não tem registros pré-2023 ("Partido sem dados em 2019-22 — sincronize via Admin").

Helper novo: `src/lib/governmentEras.ts` com `eraDe(ano)` e médias por era.

## 5. Comparador temático Lula × Bolsonaro

Nova aba em `Insights.tsx` chamada **"Governos"** (próxima a Tendências):

- Fonte: `votacao_temas` + `votos_deputados`/`votos_senadores` + `orientacoes`.
- UI:
  - Toggle de tema (Economia, Social, Segurança, Meio Ambiente, Direitos Humanos, etc. — temas existentes em `votacao_temas`).
  - Para cada tema, dois cards lado-a-lado:
    - **Era Bolsonaro 2019-22**: nº votações classificadas, % aprovadas, alinhamento médio com governo da época.
    - **Era Lula 2023-26**: idem.
    - Δ em % para destacar mudança.
  - Mini ranking de partidos com maior shift entre eras no tema.
- Reaproveita `get_monthly_alignment` mas estendido: precisaríamos de um helper SQL ou agregação client-side por tema/ano.

Decisão: agregação **client-side** (sem nova função SQL) usando `useInsightsData` já paginado; performance OK pois temas são poucos.

---

## Detalhes técnicos

### Arquivos editados
- `src/pages/Insights.tsx` — `ANOS` 2019+, nova aba "Governos", passar `ano` ao `BrazilMap`.
- `src/pages/Index.tsx`, `src/pages/Senado.tsx` — idem `ANOS`.
- `src/hooks/useInsightsData.ts` — `ALL_YEARS` 2019+.
- `src/components/insights/BrazilMap.tsx` — `tonalColor`, HoverCard tooltip, prop `ano`.
- `src/components/insights/PartidoInsightsTab.tsx` — nova sub-aba "Bolsonaro × Lula".
- `src/lib/governmentEras.ts` (novo) — helpers `eraDe(ano)`, `mediasPorEra(...)`.
- `src/components/insights/GovernosCompareTab.tsx` (novo) — comparador temático.
- `src/components/AdminBulkSync.tsx` — preset "2020-2022 (gap)" para fechar lacuna rapidamente.

### Sync data (manual, via UI Admin após deploy)
- Admin clica "Era Bolsonaro" → roda 2019-2022 Câmara+Senado.
- Em seguida: rodar `classify-votacoes` para os mesmos anos.

### Sem migrations
Todo o trabalho usa tabelas existentes.

### Acceptance
- Selectors mostram 2019-2026.
- Mapa: SP score 58% aparece azul-médio (não verde); tooltip mostra "Centro · 58% · 2025".
- Aba "Meu Partido" → "Bolsonaro × Lula" mostra gráfico com 2 eras (após sync 2020-22).
- Aba "Governos" lista temas com Δ% entre eras.
