import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PESO_TIPO: Record<string, number> = {
  PEC: 1.0, PLP: 0.8, PL: 0.6, MPV: 0.7, PDL: 0.4, PRC: 0.4, REQ: 0.1,
};

const ABRANGENCIA_TEMA: Record<string, number> = {
  "Econômico": 1.0, "Tributário": 1.0,
  "Social": 0.9, "Saúde": 0.9, "Educação": 0.9,
  "Segurança": 0.8, "Direitos Humanos": 0.8,
  "Trabalhista": 0.8, "Meio Ambiente": 0.8,
  "Infraestrutura": 0.7, "Agropecuária": 0.7,
  "Político-Institucional": 0.5, "Defesa": 0.7,
  "Cultura": 0.4, "Tecnologia": 0.6,
  "Outros": 0.3,
};

function statusWeight(status: string | null): number {
  if (!status) return 0.3;
  const s = status.toLowerCase();
  if (s.includes("promulgada") || s.includes("transformad")) return 1.0;
  if (s.includes("aprovad")) return 0.7;
  if (s.includes("arquivad") || s.includes("rejeit")) return 0.0;
  return 0.3; // em tramitação
}

async function calcImpact(sb: any, parlamentar_id: number, casa: string, ano: number) {
  const { data } = await sb
    .from("proposicoes_parlamentares")
    .select("tipo,tema,peso_tipo,status_tramitacao,ano")
    .eq("parlamentar_id", parlamentar_id).eq("casa", casa).eq("ano", ano);
  if (!data || data.length === 0) return { score: 0, count: 0 };
  let sum = 0;
  for (const p of data) {
    const w = p.peso_tipo ?? PESO_TIPO[p.tipo] ?? 0.3;
    const s = statusWeight(p.status_tramitacao);
    const a = ABRANGENCIA_TEMA[p.tema || "Outros"] ?? 0.3;
    sum += w * Math.max(s, 0.2) * a;
  }
  // normalize roughly: assume max 30 propositions weighted ~1 each
  const score = Math.min(1, sum / Math.max(10, data.length));
  return { score, count: data.length };
}

async function calcPresence(parlamentar_id: number, ano: number): Promise<{ score: number; raw: any }> {
  try {
    const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${parlamentar_id}/eventos?dataInicio=${ano}-01-01&dataFim=${ano}-12-31&itens=100`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { score: 0.5, raw: { error: r.status } };
    const j = await r.json();
    const total = (j.dados || []).length;
    if (total === 0) return { score: 0.5, raw: { total: 0 } };
    // Heuristic: presence proxy by number of events listed (cap 80 for ratio)
    const score = Math.min(1, total / 80);
    return { score, raw: { eventos: total } };
  } catch {
    return { score: 0.5, raw: {} };
  }
}

async function calcEngagement(parlamentar_id: number): Promise<{ score: number; raw: any }> {
  try {
    const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${parlamentar_id}/orgaos?itens=100`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { score: 0.3, raw: { error: r.status } };
    const j = await r.json();
    const orgaos = j.dados || [];
    const isRelator = orgaos.filter((o: any) => /relator|presid/i.test(o.titulo || "")).length;
    const total = orgaos.length;
    const score = Math.min(1, total / 8 + isRelator * 0.15);
    return { score, raw: { comissoes: total, relatorias: isRelator } };
  } catch {
    return { score: 0.3, raw: {} };
  }
}

async function calcSenadoEngagement(senador_id: number): Promise<{ score: number; raw: any }> {
  try {
    const url = `https://legis.senado.leg.br/dadosabertos/senador/${senador_id}/comissoes?v=5`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { score: 0.3, raw: { error: r.status } };
    const j = await r.json();
    const comissoes = j?.MembroComissaoParlamentar?.Parlamentar?.MembroComissoes?.Comissao || [];
    const arr = Array.isArray(comissoes) ? comissoes : [comissoes];
    const total = arr.length;
    const isRelator = arr.filter((c: any) => /titular|presid|relator/i.test(c?.DescricaoParticipacao || "")).length;
    const score = Math.min(1, total / 6 + isRelator * 0.1);
    return { score, raw: { comissoes: total, titular_presid: isRelator } };
  } catch {
    return { score: 0.3, raw: {} };
  }
}

async function calcSenadoPresence(senador_id: number, ano: number): Promise<{ score: number; raw: any }> {
  try {
    const url = `https://legis.senado.leg.br/dadosabertos/senador/${senador_id}/votacoes?ano=${ano}&v=5`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { score: 0.5, raw: { error: r.status } };
    const j = await r.json();
    const votacoes = j?.VotacaoParlamentar?.Parlamentar?.Votacoes?.Votacao || [];
    const arr = Array.isArray(votacoes) ? votacoes : [votacoes];
    const total = arr.length;
    const presentes = arr.filter((v: any) => {
      const voto = (v?.SiglaVoto || v?.DescricaoVoto || "").toString().toUpperCase();
      return voto && !/AUSENTE|N\.COMP|NAO COMP/i.test(voto);
    }).length;
    if (total === 0) return { score: 0.5, raw: { total: 0 } };
    return { score: presentes / total, raw: { total, presentes } };
  } catch {
    return { score: 0.5, raw: {} };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const ano = body.ano ?? new Date().getFullYear();
    const limit = body.limit ?? 50;
    const casa = body.casa ?? "camara";
    const parlamentarIds: number[] | null = Array.isArray(body.parlamentar_ids) && body.parlamentar_ids.length > 0
      ? body.parlamentar_ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
      : null;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Source list from analises (already has alignment + denormalized fields)
    const tableA = casa === "camara" ? "analises_deputados" : "analises_senadores";
    const idCol = casa === "camara" ? "deputado_id" : "senador_id";
    const nomeCol = casa === "camara" ? "deputado_nome" : "senador_nome";
    const partidoCol = casa === "camara" ? "deputado_partido" : "senador_partido";
    const ufCol = casa === "camara" ? "deputado_uf" : "senador_uf";
    const fotoCol = casa === "camara" ? "deputado_foto" : "senador_foto";

    let listQuery = sb.from(tableA).select("*").eq("ano", ano);
    if (parlamentarIds) {
      listQuery = listQuery.in(idCol, parlamentarIds);
    } else {
      listQuery = listQuery.order("score", { ascending: false }).limit(limit);
    }
    const { data: list } = await listQuery;
    if (!list || list.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows: any[] = [];
    for (const a of list) {
      const pid = a[idCol];
      const A = (a.score || 0) / 100;
      const [presObj, engObj, impObj] = await Promise.all([
        casa === "camara" ? calcPresence(pid, ano) : calcSenadoPresence(pid, ano),
        casa === "camara" ? calcEngagement(pid) : calcSenadoEngagement(pid),
        calcImpact(sb, pid, casa, ano),
      ]);
      const total = (A * 0.25 + presObj.score * 0.25 + impObj.score * 0.30 + engObj.score * 0.20) * 100;
      rows.push({
        parlamentar_id: pid, casa, ano,
        nome: a[nomeCol], partido: a[partidoCol], uf: a[ufCol], foto: a[fotoCol],
        score_alinhamento: A,
        score_presenca: presObj.score,
        score_impacto: impObj.score,
        score_engajamento: engObj.score,
        score_total: Math.round(total * 10) / 10,
        dados_brutos: { presenca: presObj.raw, engajamento: engObj.raw, impacto: { count: impObj.count } },
      });
    }

    for (let i = 0; i < rows.length; i += 50) {
      await sb.from("deputy_performance_scores").upsert(rows.slice(i, i + 50), {
        onConflict: "parlamentar_id,casa,ano",
      });
    }

    return new Response(JSON.stringify({ ok: true, processed: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calculate-performance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
