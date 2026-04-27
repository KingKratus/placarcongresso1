import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { parlamentar_id, casa, nome } = await req.json();
    const parlamentarId = Number(parlamentar_id);
    if (!Number.isFinite(parlamentarId) || !["camara", "senado"].includes(String(casa))) return json({ error: "Parâmetros inválidos" }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: emendas } = await sb.from("emendas_parlamentares_cache").select("tipo,numero,ano,ementa,situacao,tema,impacto_estimado,area_politica,publico_afetado,tipo_beneficio,resumo_ia,confianca").eq("parlamentar_id", parlamentarId).eq("casa", casa).order("ano", { ascending: false }).limit(200);
    if (!emendas?.length) return json({ insights: "Nenhuma emenda encontrada para gerar insights." });
    const byTema: Record<string, number> = {}, byImpacto: Record<string, number> = {}, bySituacao: Record<string, number> = {};
    for (const e of emendas) { byTema[e.tema || "Outros"] = (byTema[e.tema || "Outros"] || 0) + 1; byImpacto[e.impacto_estimado || "Médio"] = (byImpacto[e.impacto_estimado || "Médio"] || 0) + 1; bySituacao[e.situacao || "Sem situação"] = (bySituacao[e.situacao || "Sem situação"] || 0) + 1; }
    const top = emendas.slice(0, 25).map((e: any) => `- ${e.tipo} ${e.numero}/${e.ano} | ${e.tema} | ${e.impacto_estimado} | ${String(e.ementa || "").slice(0, 160)}`).join("\n");
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ insights: "IA indisponível para gerar análise." }, 500);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: "Você é analista legislativo e orçamentário. Gere análise objetiva em markdown, sem emojis." }, { role: "user", content: `Analise as emendas de ${nome || "parlamentar"}. Total: ${emendas.length}. Por tema: ${JSON.stringify(byTema)}. Por impacto: ${JSON.stringify(byImpacto)}. Por situação: ${JSON.stringify(bySituacao)}. Emendas recentes:\n${top}\n\nGere: 1) foco temático; 2) impacto político; 3) públicos beneficiados; 4) riscos/lacunas; 5) destaques prioritários.` }] }) });
    if (!resp.ok) return json({ error: resp.status === 429 ? "Limite de IA excedido." : resp.status === 402 ? "Créditos de IA insuficientes." : "Erro na IA" }, resp.status === 429 || resp.status === 402 ? resp.status : 500);
    const ai = await resp.json();
    return json({ insights: ai.choices?.[0]?.message?.content || "Não foi possível gerar insights." });
  } catch (e) { console.error("insights-emendas error", e); return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500); }
});
