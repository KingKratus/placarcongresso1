import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_HOURS = 72;
const TEMAS = "Econômico, Social, Segurança, Educação, Saúde, Meio Ambiente, Infraestrutura, Político-Institucional, Trabalhista, Tributário, Direitos Humanos, Cultura, Tecnologia, Agropecuária, Defesa, Orçamento, Outros";

type Casa = "camara" | "senado";
interface EmendaRaw {
  tipo: string; numero: string; ano: number; proposicao_tipo?: string | null; proposicao_numero?: string | null; proposicao_ano?: number | null;
  ementa?: string | null; situacao?: string | null; valor?: number | null; data_apresentacao?: string | null; url?: string | null; raw_data?: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function fetchCamaraEmendas(parlamentarId: number): Promise<{ emendas: EmendaRaw[]; notice?: string }> {
  const propsResp = await fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes?idDeputadoAutor=${parlamentarId}&siglaTipo=EMC&siglaTipo=EMP&siglaTipo=EMR&siglaTipo=EMA&ordem=DESC&ordenarPor=ano&itens=100`, { headers: { Accept: "application/json" } });
  const data = propsResp.ok ? await propsResp.json() : null;
  const items = data?.dados || [];
  const emendas: EmendaRaw[] = items.map((p: any) => ({
    tipo: p.siglaTipo || "EMD",
    numero: String(p.numero || p.id || "0"),
    ano: Number(p.ano || new Date().getFullYear()),
    ementa: p.ementa || p.descricaoTipo || "Emenda parlamentar",
    situacao: p.descricaoSituacao || "Em tramitação",
    data_apresentacao: p.dataApresentacao || null,
    url: p.uri ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}` : null,
    raw_data: p,
  }));
  return { emendas, notice: emendas.length ? undefined : "A API oficial não retornou emendas diretamente para este parlamentar. Quando houver emendas vinculadas, elas serão classificadas e exibidas aqui." };
}

async function fetchSenadoEmendas(parlamentarId: number): Promise<{ emendas: EmendaRaw[]; notice?: string }> {
  const resp = await fetch(`https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?codigoParticipante=${parlamentarId}&sigla=EMD&v=7`, { headers: { Accept: "application/json" } });
  const json = resp.ok ? await resp.json() : null;
  const materias = json?.PesquisaBasicaMateria?.Materias?.Materia || [];
  const arr = Array.isArray(materias) ? materias : [materias].filter(Boolean);
  const emendas: EmendaRaw[] = arr.map((m: any) => {
    const id = m?.IdentificacaoMateria || {};
    return {
      tipo: id.SiglaSubtipoMateria || id.SiglaTipoMateria || "EMD",
      numero: String(id.NumeroMateria || id.CodigoMateria || "0"),
      ano: Number(id.AnoMateria || new Date().getFullYear()),
      ementa: m?.EmentaMateria || m?.Ementa || "Emenda parlamentar",
      situacao: m?.DescricaoSituacao || m?.SituacaoAtual || "Em tramitação",
      data_apresentacao: m?.DataApresentacao || null,
      url: id.CodigoMateria ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${id.CodigoMateria}` : null,
      raw_data: m,
    };
  });
  return { emendas, notice: emendas.length ? undefined : "A API oficial do Senado não expôs emendas por parlamentar neste recorte. O painel fica pronto para exibir dados assim que houver retorno oficial ou cache." };
}

async function classifyEmendas(emendas: EmendaRaw[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || emendas.length === 0) return {} as Record<number, any>;
  const result: Record<number, any> = {};
  for (let i = 0; i < emendas.length; i += 20) {
    const batch = emendas.slice(i, i + 20);
    const prompt = batch.map((e, idx) => `${idx + 1}. [${e.tipo} ${e.numero}/${e.ano}] ${e.ementa || "Sem ementa"} Situação: ${e.situacao || "não informada"}`).join("\n");
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `Classifique emendas parlamentares brasileiras. Temas possíveis: ${TEMAS}. Responda somente JSON: {"1":{"tema":"...","impacto_estimado":"Baixo|Médio|Alto","area_politica":"...","publico_afetado":"...","tipo_beneficio":"...","resumo_ia":"frase objetiva","confianca":0.0}}` },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      const content = json.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]);
      for (const [k, v] of Object.entries(parsed)) result[i + Number(k) - 1] = v;
    } catch (e) { console.error("classify emendas error", e); }
  }
  return result;
}

function cacheKey(parlamentarId: number, casa: Casa, e: EmendaRaw) {
  return `${parlamentarId}|${casa}|${e.tipo}|${e.numero}|${e.ano}|${e.proposicao_tipo || ""}|${e.proposicao_numero || ""}|${e.proposicao_ano || ""}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const parlamentarId = Number(body?.parlamentar_id);
    const casa = String(body?.casa || "").toLowerCase() as Casa;
    const nome = String(body?.nome || "").slice(0, 160);
    const force = !!body?.force;
    if (!Number.isFinite(parlamentarId) || parlamentarId <= 0 || !["camara", "senado"].includes(casa)) return jsonResponse({ error: "Parâmetros inválidos" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!force) {
      const { data: cached } = await sb.from("emendas_parlamentares_cache").select("*").eq("parlamentar_id", parlamentarId).eq("casa", casa).order("ano", { ascending: false });
      const fresh = cached?.length && Date.now() - new Date(cached[0].fetched_at).getTime() < CACHE_TTL_HOURS * 3600 * 1000;
      if (fresh) return jsonResponse({ emendas: cached, source: "cache" });
    }

    const fetched = casa === "camara" ? await fetchCamaraEmendas(parlamentarId) : await fetchSenadoEmendas(parlamentarId);
    const classified = await classifyEmendas(fetched.emendas);
    const rows = fetched.emendas.map((e, idx) => {
      const c = classified[idx] || {};
      return {
        parlamentar_id: parlamentarId, casa, parlamentar_nome: nome || null, tipo: e.tipo || "EMD", numero: e.numero || String(idx + 1), ano: e.ano || new Date().getFullYear(),
        proposicao_tipo: e.proposicao_tipo || null, proposicao_numero: e.proposicao_numero || null, proposicao_ano: e.proposicao_ano || null,
        ementa: e.ementa || null, situacao: e.situacao || "Em tramitação", valor: e.valor || null, data_apresentacao: e.data_apresentacao || null, url: e.url || null,
        tema: c.tema || "Outros", impacto_estimado: ["Baixo", "Médio", "Alto"].includes(c.impacto_estimado) ? c.impacto_estimado : "Médio",
        area_politica: c.area_politica || null, publico_afetado: c.publico_afetado || null, tipo_beneficio: c.tipo_beneficio || null, resumo_ia: c.resumo_ia || null,
        confianca: Math.max(0, Math.min(1, Number(c.confianca || 0.55))), source: "api", raw_data: e.raw_data || {}, fetched_at: new Date().toISOString(), cache_key: cacheKey(parlamentarId, casa, e),
      };
    });

    if (rows.length) {
      for (let i = 0; i < rows.length; i += 50) await sb.from("emendas_parlamentares_cache").upsert(rows.slice(i, i + 50), { onConflict: "cache_key" });
      const { data } = await sb.from("emendas_parlamentares_cache").select("*").eq("parlamentar_id", parlamentarId).eq("casa", casa).order("ano", { ascending: false });
      return jsonResponse({ emendas: data || rows, source: "api", notice: fetched.notice });
    }
    return jsonResponse({ emendas: [], source: "api", notice: fetched.notice });
  } catch (e) {
    console.error("fetch-emendas error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
