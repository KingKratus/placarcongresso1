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

  const [camara, senado, temas, orientacoes] = await Promise.all([
    sb.from("analises_deputados").select("deputado_nome, deputado_partido, deputado_uf, classificacao, score, total_votos, ano").order("score", { ascending: false }).limit(500),
    sb.from("analises_senadores").select("senador_nome, senador_partido, senador_uf, classificacao, score, total_votos, ano").order("score", { ascending: false }).limit(300),
    sb.from("votacao_temas").select("tema, casa, ano").limit(2000),
    sb.from("orientacoes").select("sigla_orgao_politico, orientacao_voto").limit(100),
  ]);

  // Summarize by party
  const partyStats: Record<string, { scores: number[]; count: number; class: Record<string, number> }> = {};
  for (const d of camara.data || []) {
    const p = d.deputado_partido || "?";
    if (!partyStats[p]) partyStats[p] = { scores: [], count: 0, class: {} };
    partyStats[p].scores.push(Number(d.score));
    partyStats[p].count++;
    partyStats[p].class[d.classificacao] = (partyStats[p].class[d.classificacao] || 0) + 1;
  }

  const partySummary = Object.entries(partyStats)
    .map(([p, s]) => {
      const avg = (s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(1);
      const mainClass = Object.entries(s.class).sort((a, b) => b[1] - a[1])[0]?.[0] || "?";
      return `${p}: ${avg}% média, ${s.count} dep., maioria ${mainClass}`;
    })
    .join("\n");

  // Theme summary
  const themeCounts: Record<string, number> = {};
  for (const t of temas.data || []) {
    themeCounts[t.tema] = (themeCounts[t.tema] || 0) + 1;
  }
  const themeSummary = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}: ${c} votações`)
    .join(", ");

  // Years available
  const years = [...new Set((camara.data || []).map(d => d.ano))].sort();

  return `
DADOS REAIS DO BANCO DE DADOS (use para responder):

Anos disponíveis: ${years.join(", ")}

Resumo por partido (Câmara):
${partySummary}

Top 10 deputados mais governistas:
${(camara.data || []).slice(0, 10).map(d => `- ${d.deputado_nome} (${d.deputado_partido}/${d.deputado_uf}): ${Number(d.score).toFixed(1)}% - ${d.classificacao}`).join("\n")}

Top 10 senadores mais governistas:
${(senado.data || []).slice(0, 10).map(s => `- ${s.senador_nome} (${s.senador_partido}/${s.senador_uf}): ${Number(s.score).toFixed(1)}% - ${s.classificacao}`).join("\n")}

Distribuição temática das votações: ${themeSummary}

Total deputados analisados: ${(camara.data || []).length}
Total senadores analisados: ${(senado.data || []).length}
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch real data context from database
    let dataContext = "";
    try {
      dataContext = await fetchDataContext();
    } catch (e) {
      console.error("Failed to fetch data context:", e);
    }

    const systemPrompt = `Você é um analista legislativo brasileiro especializado com acesso a dados REAIS do Congresso Nacional. Use SEMPRE os dados fornecidos abaixo para embasar suas respostas.

${dataContext}

${context ? `\nContexto adicional:\n${context}` : ""}

REGRAS:
- Responda SEMPRE em português brasileiro
- Use markdown para formatação (negrito, listas, tabelas)
- Cite dados específicos (nomes, partidos, scores) quando disponíveis
- Seja preciso e analítico, nunca invente dados
- Se não tiver dados suficientes, diga claramente
- Use emojis para tornar a resposta mais visual (📊 📈 🏛️ etc)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
