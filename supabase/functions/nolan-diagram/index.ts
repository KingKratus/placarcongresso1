import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generates a Nolan-chart position for a parliamentarian using Lovable AI.
 * Axes go from -1 (left/libertarian) to +1 (right/authoritarian).
 *  - economic_axis: -1 = state-controlled / left ; +1 = free-market / right
 *  - social_axis:   -1 = libertarian / progressive ; +1 = authoritarian / conservative
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { parlamentar_id, casa, ano, force } = await req.json();
    if (!parlamentar_id || !casa || !ano) {
      return new Response(JSON.stringify({ error: "parlamentar_id, casa and ano required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Cache check
    if (!force) {
      const { data: cached } = await sb
        .from("nolan_diagrams")
        .select("*")
        .eq("parlamentar_id", parlamentar_id).eq("casa", casa).eq("ano", ano)
        .maybeSingle();
      if (cached) {
        return new Response(JSON.stringify({ ...cached, source: "cache" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Gather signals: top proposições + classification
    const tableA = casa === "camara" ? "analises_deputados" : "analises_senadores";
    const idCol = casa === "camara" ? "deputado_id" : "senador_id";
    const nomeCol = casa === "camara" ? "deputado_nome" : "senador_nome";
    const partidoCol = casa === "camara" ? "deputado_partido" : "senador_partido";

    const { data: analise } = await sb.from(tableA).select("*").eq(idCol, parlamentar_id).eq("ano", ano).maybeSingle();
    if (!analise) {
      return new Response(JSON.stringify({ error: "Sem dados para o ano" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: props } = await sb
      .from("proposicoes_parlamentares")
      .select("tipo,numero,ano,ementa,tema,status_tramitacao")
      .eq("parlamentar_id", parlamentar_id).eq("casa", casa)
      .order("ano", { ascending: false })
      .limit(40);

    const nome = (analise as any)[nomeCol];
    const partido = (analise as any)[partidoCol];
    const classificacao = (analise as any).classificacao;
    const score = (analise as any).score;

    const propsText = (props || []).slice(0, 30).map((p: any) =>
      `- [${p.tema || "?"}] ${p.tipo} ${p.numero}/${p.ano}: ${(p.ementa || "").slice(0, 140)}`
    ).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um cientista político analisando ${nome} (${partido}, ${classificacao}, alinhamento com governo: ${score}%) com base em proposições legislativas.\n\nProposições recentes:\n${propsText || "(sem proposições recentes)"}\n\nPosicione no Diagrama de Nolan em duas dimensões de -1 a +1:\n- economic_axis: -1 = intervenção estatal/esquerda econômica ; +1 = livre mercado/direita econômica\n- social_axis: -1 = libertário/progressista ; +1 = autoritário/conservador\n\nUse a tool "set_nolan_position".`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista político neutro e baseado em evidências." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "set_nolan_position",
            description: "Define a posição do parlamentar no Diagrama de Nolan",
            parameters: {
              type: "object",
              properties: {
                economic_axis: { type: "number", minimum: -1, maximum: 1 },
                social_axis: { type: "number", minimum: -1, maximum: 1 },
                rationale: { type: "string", description: "2-3 frases justificando a posição com base nas proposições e voto." },
              },
              required: ["economic_axis", "social_axis", "rationale"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_nolan_position" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: `AI: ${aiResp.status}`, detail: t.slice(0, 200) }), {
        status: aiResp.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiResp.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "AI did not return a position" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(call.function.arguments || "{}");

    const row = {
      parlamentar_id, casa, ano,
      economic_axis: Math.max(-1, Math.min(1, Number(args.economic_axis) || 0)),
      social_axis: Math.max(-1, Math.min(1, Number(args.social_axis) || 0)),
      rationale: String(args.rationale || ""),
      updated_at: new Date().toISOString(),
    };
    await sb.from("nolan_diagrams").upsert(row, { onConflict: "parlamentar_id,casa,ano" });

    return new Response(JSON.stringify({ ...row, source: "ai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nolan-diagram error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
