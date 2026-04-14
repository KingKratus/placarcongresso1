import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { parlamentar_id, casa, nome } = await req.json();
    if (!parlamentar_id || !casa) {
      return new Response(JSON.stringify({ error: "parlamentar_id and casa required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(url, key);

    const { data: proposicoes } = await sb
      .from("proposicoes_parlamentares")
      .select("tipo, numero, ano, ementa, tema")
      .eq("parlamentar_id", parlamentar_id)
      .eq("casa", casa)
      .order("ano", { ascending: false });

    if (!proposicoes || proposicoes.length === 0) {
      return new Response(JSON.stringify({ insights: "Nenhuma proposição encontrada para gerar insights." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context
    const byTheme: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byYear: Record<number, number> = {};
    for (const p of proposicoes) {
      byTheme[p.tema || "Outros"] = (byTheme[p.tema || "Outros"] || 0) + 1;
      byType[p.tipo] = (byType[p.tipo] || 0) + 1;
      byYear[p.ano] = (byYear[p.ano] || 0) + 1;
    }

    const themeSummary = Object.entries(byTheme).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}`).join(", ");
    const typeSummary = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}`).join(", ");
    const yearSummary = Object.entries(byYear).sort((a, b) => Number(b[0]) - Number(a[0])).map(([y, c]) => `${y}: ${c}`).join(", ");

    const topProposicoes = proposicoes.slice(0, 30).map(p => `- [${p.tipo} ${p.numero}/${p.ano}] ${p.tema}: ${(p.ementa || "").slice(0, 150)}`).join("\n");

    const prompt = `Analise as proposições legislativas de ${nome || "parlamentar"} (${casa === "camara" ? "Deputado(a) Federal" : "Senador(a)"}).

Total: ${proposicoes.length} proposições
Por tema: ${themeSummary}
Por tipo: ${typeSummary}
Por ano: ${yearSummary}

Proposições recentes:
${topProposicoes}

Gere um relatório em markdown com:
1. **Perfil Legislativo**: Resumo do foco temático
2. **Áreas de Destaque**: Top 3 temas com análise
3. **Evolução Temporal**: Como mudou ao longo dos mandatos
4. **Tipos Preferidos**: Quais instrumentos legislativos mais usa
5. **Observações**: Insights relevantes sobre o padrão legislativo

Use emojis, seja objetivo e analítico.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista legislativo brasileiro especializado. Gere insights precisos e concisos sobre a atuação legislativa de parlamentares, em português brasileiro." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiJson = await resp.json();
    const insights = aiJson.choices?.[0]?.message?.content || "Não foi possível gerar insights.";

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("insights-proposicoes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
