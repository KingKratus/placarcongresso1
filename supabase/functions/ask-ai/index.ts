import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchDataContext(): Promise<string> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(url, key);

  const [camara, senado, temas, votacoesCamara, votacoesSenado, emendasOrc] = await Promise.all([
    sb.from("analises_deputados")
      .select("deputado_nome, deputado_partido, deputado_uf, classificacao, score, total_votos, votos_alinhados, ano")
      .order("score", { ascending: false }).limit(800),
    sb.from("analises_senadores")
      .select("senador_nome, senador_partido, senador_uf, classificacao, score, total_votos, votos_alinhados, ano")
      .order("score", { ascending: false }).limit(500),
    sb.from("votacao_temas").select("tema, casa, ano").limit(3000),
    sb.from("votacoes")
      .select("id_votacao, descricao, proposicao_tipo, proposicao_numero, proposicao_ementa, ano, data, sigla_orgao")
      .order("data", { ascending: false }).limit(200),
    sb.from("votacoes_senado")
      .select("codigo_sessao_votacao, descricao, sigla_materia, numero_materia, ementa, resultado, ano, data")
      .order("data", { ascending: false }).limit(200),
    sb.from("emendas_orcamentarias_transparencia")
      .select("ano,tipo_emenda,nome_autor,partido,uf,localidade_gasto,funcao,subfuncao,valor_empenhado,valor_pago,valor_resto_pago,tema_ia,subtema_ia,risco_execucao,estagio_execucao")
      .order("valor_pago", { ascending: false }).limit(600),
  ]);

  const camaraData = camara.data || [];
  const senadoData = senado.data || [];
  const temasData = temas.data || [];
  const emendasData = emendasOrc.data || [];

  // All years
  const allYears = [...new Set([
    ...camaraData.map(d => d.ano),
    ...senadoData.map(d => d.ano),
  ])].sort();

  // Per-year party stats (Câmara)
  const yearPartyBlocks: string[] = [];
  for (const year of allYears) {
    const yearDeps = camaraData.filter(d => d.ano === year);
    const yearSens = senadoData.filter(s => s.ano === year);
    if (yearDeps.length === 0 && yearSens.length === 0) continue;

    // Party aggregation for this year
    const ps: Record<string, { scores: number[]; count: number; cls: Record<string, number>; votos: number }> = {};
    for (const d of yearDeps) {
      const p = d.deputado_partido || "?";
      if (!ps[p]) ps[p] = { scores: [], count: 0, cls: {}, votos: 0 };
      ps[p].scores.push(Number(d.score));
      ps[p].count++;
      ps[p].votos += Number(d.total_votos);
      ps[p].cls[d.classificacao] = (ps[p].cls[d.classificacao] || 0) + 1;
    }

    const partySummary = Object.entries(ps)
      .sort((a, b) => {
        const avgA = a[1].scores.reduce((x, y) => x + y, 0) / a[1].scores.length;
        const avgB = b[1].scores.reduce((x, y) => x + y, 0) / b[1].scores.length;
        return avgB - avgA;
      })
      .map(([p, s]) => {
        const avg = (s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(1);
        const mainClass = Object.entries(s.cls).sort((a, b) => b[1] - a[1])[0]?.[0] || "?";
        return `  ${p}: ${avg}% média, ${s.count} dep., ${s.votos} votos totais, maioria ${mainClass}`;
      })
      .join("\n");

    const top5Deps = yearDeps.slice(0, 5)
      .map(d => `  - ${d.deputado_nome} (${d.deputado_partido}/${d.deputado_uf}): ${Number(d.score).toFixed(1)}% alinhamento, ${d.total_votos} votos`)
      .join("\n");

    const bottom5Deps = [...yearDeps].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 5)
      .map(d => `  - ${d.deputado_nome} (${d.deputado_partido}/${d.deputado_uf}): ${Number(d.score).toFixed(1)}% alinhamento`)
      .join("\n");

    const top5Sens = yearSens.slice(0, 5)
      .map(s => `  - ${s.senador_nome} (${s.senador_partido}/${s.senador_uf}): ${Number(s.score).toFixed(1)}% alinhamento, ${s.total_votos} votos`)
      .join("\n");

    const bottom5Sens = [...yearSens].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 5)
      .map(s => `  - ${s.senador_nome} (${s.senador_partido}/${s.senador_uf}): ${Number(s.score).toFixed(1)}% alinhamento`)
      .join("\n");

    // Classification distribution
    const clsDist: Record<string, number> = {};
    for (const d of yearDeps) clsDist[d.classificacao] = (clsDist[d.classificacao] || 0) + 1;
    const clsSummary = Object.entries(clsDist).map(([c, n]) => `${c}: ${n}`).join(", ");

    // Theme distribution for this year
    const yearTemas = temasData.filter(t => t.ano === year);
    const tc: Record<string, number> = {};
    for (const t of yearTemas) tc[t.tema] = (tc[t.tema] || 0) + 1;
    const themeSummary = Object.entries(tc).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}`).join(", ");

    yearPartyBlocks.push(`
═══ ANO ${year} ═══
Câmara: ${yearDeps.length} deputados analisados | Senado: ${yearSens.length} senadores
Classificação Câmara: ${clsSummary}

Partidos (Câmara, ordenados por governismo):
${partySummary}

Top 5 mais governistas (Câmara):
${top5Deps}

Top 5 mais oposicionistas (Câmara):
${bottom5Deps}

Top 5 mais governistas (Senado):
${top5Sens}

Top 5 mais oposicionistas (Senado):
${bottom5Sens}

Temas das votações em ${year}: ${themeSummary || "Sem dados temáticos"}
`);
  }

  // Recent votacoes (Câmara)
  const recentVotCamara = (votacoesCamara.data || []).slice(0, 15)
    .map(v => `  - [${v.ano}] ${v.proposicao_tipo || ""} ${v.proposicao_numero || ""}: ${(v.proposicao_ementa || v.descricao || "").slice(0, 120)}`)
    .join("\n");

  // Recent votacoes (Senado)
  const recentVotSenado = (votacoesSenado.data || []).slice(0, 15)
    .map(v => `  - [${v.ano}] ${v.sigla_materia || ""} ${v.numero_materia || ""}: ${(v.ementa || v.descricao || "").slice(0, 120)} → ${v.resultado || "?"}`)
    .join("\n");

  // Cross-year party evolution
  const partyEvolution: Record<string, Record<number, number>> = {};
  for (const d of camaraData) {
    const p = d.deputado_partido || "?";
    if (!partyEvolution[p]) partyEvolution[p] = {};
    if (!partyEvolution[p][d.ano]) partyEvolution[p][d.ano] = 0;
    partyEvolution[p][d.ano] += Number(d.score);
  }
  const partyCounts: Record<string, Record<number, number>> = {};
  for (const d of camaraData) {
    const p = d.deputado_partido || "?";
    if (!partyCounts[p]) partyCounts[p] = {};
    partyCounts[p][d.ano] = (partyCounts[p][d.ano] || 0) + 1;
  }

  const majorParties = Object.entries(partyCounts)
    .filter(([, yc]) => Object.values(yc).some(c => c >= 5))
    .map(([p]) => p);

  const evolutionLines = majorParties.map(p => {
    const yearAvgs = allYears
      .filter(y => partyCounts[p]?.[y])
      .map(y => `${y}: ${(partyEvolution[p][y] / partyCounts[p][y]).toFixed(1)}%`);
    return `  ${p}: ${yearAvgs.join(" → ")}`;
  }).join("\n");

  const emendasTema: Record<string, { pago: number; empenhado: number; count: number }> = {};
  const emendasAutor: Record<string, { pago: number; empenhado: number; count: number }> = {};
  const emendasPartido: Record<string, { pago: number; empenhado: number; count: number }> = {};
  for (const e of emendasData) {
    const pago = Number(e.valor_pago || 0) + Number(e.valor_resto_pago || 0);
    const empenhado = Number(e.valor_empenhado || 0);
    const add = (map: Record<string, { pago: number; empenhado: number; count: number }>, key: string) => {
      map[key] = map[key] || { pago: 0, empenhado: 0, count: 0 };
      map[key].pago += pago; map[key].empenhado += empenhado; map[key].count++;
    };
    add(emendasTema, e.tema_ia || e.funcao || "Outros");
    add(emendasAutor, e.nome_autor || "Autor não informado");
    add(emendasPartido, e.partido || "Partido não identificado");
  }
  const emendasSummary = (map: Record<string, { pago: number; empenhado: number; count: number }>) => Object.entries(map)
    .sort((a, b) => b[1].pago - a[1].pago)
    .slice(0, 8)
    .map(([k, v]) => `${k}: R$ ${Math.round(v.pago).toLocaleString("pt-BR")} pagos / R$ ${Math.round(v.empenhado).toLocaleString("pt-BR")} empenhados (${v.count} emendas)`)
    .join("\n");

  return `
DADOS REAIS DO BANCO DE DADOS DO CONGRESSO NACIONAL BRASILEIRO
(Use SEMPRE estes dados para embasar suas respostas)

Anos disponíveis: ${allYears.join(", ")}
Total deputados analisados: ${camaraData.length}
Total senadores analisados: ${senadoData.length}

${yearPartyBlocks.join("\n")}

═══ EVOLUÇÃO DO GOVERNISMO POR PARTIDO (médias anuais) ═══
${evolutionLines}

═══ EMENDAS ORÇAMENTÁRIAS DO PORTAL DA TRANSPARÊNCIA ═══
Registros carregados no contexto: ${emendasData.length}
Top temas por valor pago:
${emendasSummary(emendasTema) || "Sem dados de emendas orçamentárias sincronizados"}
Top autores por valor pago:
${emendasSummary(emendasAutor) || "Sem dados"}
Top partidos por valor pago:
${emendasSummary(emendasPartido) || "Sem dados"}

═══ VOTAÇÕES RECENTES DA CÂMARA ═══
${recentVotCamara}

═══ VOTAÇÕES RECENTES DO SENADO ═══
${recentVotSenado}
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, custom_api_key, custom_provider } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY && !custom_api_key) throw new Error("No API key available");

    let dataContext = "";
    try {
      dataContext = await fetchDataContext();
    } catch (e) {
      console.error("Failed to fetch data context:", e);
    }

    const systemPrompt = `Você é o **Placar do Congresso AI**, um analista legislativo brasileiro especializado com acesso a dados REAIS e atualizados do Congresso Nacional (Câmara dos Deputados e Senado Federal).

${dataContext}

${context ? `\nContexto adicional do usuário:\n${context}` : ""}

CAPACIDADES:
- Analisar alinhamento de parlamentares com o governo por ano (2023-2026)
- Comparar partidos e sua evolução ao longo dos anos
- Identificar tendências de governismo/oposição
- Analisar distribuição temática das votações
- Detalhar votações específicas recentes
- Comparar Câmara vs Senado
- Analisar emendas parlamentares orçamentárias do Portal da Transparência por valor empenhado, liquidado, pago, autor, partido, UF, tema/subtema IA e risco de execução

REGRAS OBRIGATÓRIAS:
1. Responda SEMPRE em português brasileiro
2. Use markdown para formatação: **negrito**, listas, tabelas quando apropriado
3. Cite dados específicos (nomes, partidos, scores, anos) — NUNCA invente dados
4. Quando o usuário perguntar sobre um ano específico, use os dados daquele ano
5. Se não tiver dados suficientes para responder, diga claramente o que falta
6. Use emojis para tornar a resposta mais visual: 📊 📈 🏛️ ⚖️ 🗳️ 🔍
7. Ao comparar anos, mostre a evolução numérica com diferenças percentuais
8. Sempre contextualize: explique o que significa "governista" (vota alinhado com orientação do governo)
9. Mantenha tom profissional mas acessível — o público são cidadãos interessados em política`;

    // Determine API endpoint and key
    let apiUrl: string;
    let apiKey: string;
    let model: string;

    if (custom_api_key) {
      if (custom_provider === "google") {
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
        apiKey = custom_api_key;
        model = "gemini-2.5-flash";
      } else {
        apiUrl = "https://api.openai.com/v1/chat/completions";
        apiKey = custom_api_key;
        model = "gpt-4o-mini";
      }
    } else {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = LOVABLE_API_KEY!;
      model = "google/gemini-2.5-flash";
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Aguarde um momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ask-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
