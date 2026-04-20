
The user wants a large bundle. Let me break it down:

1. **Mini live chart (line)** showing score_total per parlamentar as SSE events arrive — add to AdminPerformanceSync, PerformanceCompare, and PerformanceTab
2. **Persist progress events to sync_run_events** — modify calculate-performance to write events to DB (need a sync_runs entry too); already have these tables with proper RLS
3. **Refactor Desempenho buttons** — both in profile (PerformanceTab) and Desempenho page must process 100% of Câmara (513) and Senado (81). Currently limit=200/100. Need to remove caps or add "process all" mode
4. **Test E2E** — manual suggestion
5. **Authorship tags in proposições tab** — add badge "Autor" / "Co-autor" in ProposicoesTab. Need to fetch authorship metadata
6. **Optional additional weight: thematic focus per deputy** — slider weights for areas like Segurança, Tributário, etc. that boost matching proposições
7. **Years 2023-2026 selector in PerformanceTab** — currently single year, add year tabs/select
8. **Manual test admin** — suggestion
9. **Manual test profile** — suggestion
10. **AbortController + "Parar" button** — already have `signal` param in streamPerformance, need UI button
11. **Nolan Diagram via AI** in parliamentary profiles — new component using Lovable AI to classify deputy on Economic (left/right) + Social (libertarian/authoritarian) axes based on their voting record + proposições, render as 2D scatter

Lots of scope. Let me check a few files quickly.
