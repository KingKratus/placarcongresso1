import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMAS = [
  "Econômico",
  "Social",
  "Segurança",
  "Educação",
  "Saúde",
  "Meio Ambiente",
  "Infraestrutura",
  "Político-Institucional",
  "Trabalhista",
  "Tributário",
  "Outros",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ano, casa } = await req.json();
    if (!ano || !casa) {
      return new Response(JSON.stringify({ error: "ano and casa are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get votações that haven't been classified yet
    const table = casa === "camara" ? "votacoes" : "votacoes_senado";
    const idCol = casa === "camara" ? "id_votacao" : "codigo_sessao_votacao";
    const ementaCol = casa === "camara" ? "proposicao_ementa" : "ementa";
    const descCol = "descricao";

    const { data: votacoes, error: vErr } = await supabase
      .from(table)
      .select("*")
      .eq("ano", ano)
      .limit(500);

    if (vErr) throw vErr;
    if (!votacoes || votacoes.length === 0) {
      return new Response(JSON.stringify({ classified: 0, message: "No votações found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get already classified
    const { data: existing } = await supabase
      .from("votacao_temas")
      .select("votacao_id")
      .eq("casa", casa)
      .eq("ano", ano);

    const existingIds = new Set((existing || []).map((e: any) => e.votacao_id));
    const unclassified = votacoes.filter((v: any) => !existingIds.has(v[idCol]));

    if (unclassified.length === 0) {
      return new Response(JSON.stringify({ classified: 0, message: "All votações already classified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in batches of 20
    const batchSize = 20;
    let totalClassified = 0;

    for (let i = 0; i < unclassified.length; i += batchSize) {
      const batch = unclassified.slice(i, i + batchSize);

      const descriptions = batch
        .map((v: any, idx: number) => {
          const ementa = v[ementaCol] || "";
          const desc = v[descCol] || "";
          const tipo = casa === "camara" ? `${v.proposicao_tipo || ""} ${v.proposicao_numero || ""}` : `${v.sigla_materia || ""} ${v.numero_materia || ""}`;
          return `[${idx}] ${tipo}: ${ementa} | ${desc}`;
        })
        .join("\n");

      const prompt = `Classifique cada votação legislativa brasileira abaixo em EXATAMENTE um dos seguintes temas:
${TEMAS.join(", ")}

Para cada votação, retorne APENAS o índice e o tema, no formato JSON array:
[{"idx": 0, "tema": "Econômico"}, ...]

Votações:
${descriptions}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Você é um classificador de votações legislativas brasileiras. Responda APENAS com JSON válido." },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_votacoes",
                description: "Classify legislative votes into themes",
                parameters: {
                  type: "object",
                  properties: {
                    classifications: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          idx: { type: "number" },
                          tema: { type: "string", enum: TEMAS },
                        },
                        required: ["idx", "tema"],
                      },
                    },
                  },
                  required: ["classifications"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "classify_votacoes" } },
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          // Rate limited, wait and continue
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        console.error("AI error:", aiResponse.status, await aiResponse.text());
        continue;
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) continue;

      let classifications: { idx: number; tema: string }[];
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        classifications = parsed.classifications || [];
      } catch {
        continue;
      }

      const inserts = classifications
        .filter((c) => c.idx >= 0 && c.idx < batch.length && TEMAS.includes(c.tema))
        .map((c) => ({
          votacao_id: batch[c.idx][idCol],
          casa,
          tema: c.tema,
          confianca: 0.8,
          ano,
        }));

      if (inserts.length > 0) {
        const { error: insertErr } = await supabase
          .from("votacao_temas")
          .upsert(inserts, { onConflict: "votacao_id,casa" });

        if (insertErr) console.error("Insert error:", insertErr);
        else totalClassified += inserts.length;
      }

      // Small delay between batches
      if (i + batchSize < unclassified.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return new Response(
      JSON.stringify({ classified: totalClassified, total: unclassified.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("classify error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
