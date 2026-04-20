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
  return 0.3;
}

async function calcImpact(sb: any, parlamentar_id: number, casa: string, ano: number) {
  const { data } = await sb
    .from("proposicoes_parlamentares")
    .select("tipo,tema,peso_tipo,status_tramitacao,ano,tipo_autoria")
    .eq("parlamentar_id", parlamentar_id).eq("casa", casa).eq("ano", ano);
  if (!data || data.length === 0) return { score: 0, count: 0, autoria: 0, coautoria: 0 };
  let sum = 0;
  let autoria = 0, coautoria = 0;
  for (const p of data) {
    const w = p.peso_tipo ?? PESO_TIPO[p.tipo] ?? 0.3;
    const s = statusWeight(p.status_tramitacao);
    const a = ABRANGENCIA_TEMA[p.tema || "Outros"] ?? 0.3;
    // Autor weighs full, co-autor weighs half
    const authorMultiplier = p.tipo_autoria === "coautor" ? 0.5 : 1.0;
    if (p.tipo_autoria === "coautor") coautoria++; else autoria++;
    sum += w * Math.max(s, 0.2) * a * authorMultiplier;
  }
  const score = Math.min(1, sum / Math.max(10, data.length));
  return { score, count: data.length, autoria, coautoria };
}

async function calcPresence(parlamentar_id: number, ano: number) {
  try {
    const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${parlamentar_id}/eventos?dataInicio=${ano}-01-01&dataFim=${ano}-12-31&itens=100`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { score: 0.5, raw: { error: r.status } };
    const j = await r.json();
    const total = (j.dados || []).length;
    if (total === 0) return { score: 0.5, raw: { total: 0 } };
    return { score: Math.min(1, total / 80), raw: { eventos: total } };
  } catch {
    return { score: 0.5, raw: {} };
  }
}

async function calcEngagement(parlamentar_id: number) {
  try {
    const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${parlamentar_id}/orgaos?itens=100`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { score: 0.3, raw: { error: r.status } };
    const j = await r.json();
    const orgaos = j.dados || [];
    const isRelator = orgaos.filter((o: any) => /relator|presid/i.test(o.titulo || "")).length;
    const total = orgaos.length;
    return { score: Math.min(1, total / 8 + isRelator * 0.15), raw: { comissoes: total, relatorias: isRelator } };
  } catch {
    return { score: 0.3, raw: {} };
  }
}

async function calcSenadoEngagement(senador_id: number) {
  try {
    const url = `https://legis.senado.leg.br/dadosabertos/senador/${senador_id}/comissoes?v=5`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { score: 0.3, raw: { error: r.status } };
    const j = await r.json();
    const comissoes = j?.MembroComissaoParlamentar?.Parlamentar?.MembroComissoes?.Comissao || [];
    const arr = Array.isArray(comissoes) ? comissoes : [comissoes];
    const total = arr.length;
    const isRelator = arr.filter((c: any) => /titular|presid|relator/i.test(c?.DescricaoParticipacao || "")).length;
    return { score: Math.min(1, total / 6 + isRelator * 0.1), raw: { comissoes: total, titular_presid: isRelator } };
  } catch {
    return { score: 0.3, raw: {} };
  }
}

async function calcSenadoPresence(senador_id: number, ano: number) {
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

async function processOne(sb: any, a: any, casa: string, ano: number, idCol: string, nomeCol: string, partidoCol: string, ufCol: string, fotoCol: string) {
  const pid = a[idCol];
  const A = (a.score || 0) / 100;
  const [presObj, engObj, impObj] = await Promise.all([
    casa === "camara" ? calcPresence(pid, ano) : calcSenadoPresence(pid, ano),
    casa === "camara" ? calcEngagement(pid) : calcSenadoEngagement(pid),
    calcImpact(sb, pid, casa, ano),
  ]);
  const total = (A * 0.25 + presObj.score * 0.25 + impObj.score * 0.30 + engObj.score * 0.20) * 100;
  return {
    parlamentar_id: pid, casa, ano,
    nome: a[nomeCol], partido: a[partidoCol], uf: a[ufCol], foto: a[fotoCol],
    score_alinhamento: A,
    score_presenca: presObj.score,
    score_impacto: impObj.score,
    score_engajamento: engObj.score,
    score_total: Math.round(total * 10) / 10,
    dados_brutos: {
      presenca: presObj.raw,
      engajamento: engObj.raw,
      impacto: { count: impObj.count, autoria: impObj.autoria, coautoria: impObj.coautoria },
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const wantStream = url.searchParams.get("stream") === "1" || req.headers.get("accept")?.includes("text/event-stream");

    const body = await req.json().catch(() => ({}));
    const ano = body.ano ?? new Date().getFullYear();
    // Default 1000 = "all" (covers Câmara 513 + Senado 81 with margin)
    const limit = body.limit ?? 1000;
    const casa = body.casa ?? "camara";
    const parlamentarIds: number[] | null = Array.isArray(body.parlamentar_ids) && body.parlamentar_ids.length > 0
      ? body.parlamentar_ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
      : null;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
    const total = list?.length ?? 0;

    // Create sync_run for audit trail
    let runId: string | null = null;
    try {
      const { data: run } = await sb
        .from("sync_runs")
        .insert({ casa: `pscore-${casa}`, ano, status: "running", summary: { total, parlamentarIds: parlamentarIds?.length ?? null } })
        .select("id")
        .single();
      runId = run?.id ?? null;
    } catch (_) { /* non-blocking */ }

    const logEvent = async (step: string, message: string) => {
      if (!runId) return;
      try {
        await sb.from("sync_run_events").insert({ run_id: runId, step, message });
      } catch (_) { /* non-blocking */ }
    };

    if (!wantStream) {
      // Legacy JSON mode (single response at the end)
      if (total === 0) {
        if (runId) await sb.from("sync_runs").update({ status: "ok", finished_at: new Date().toISOString(), summary: { processed: 0 } }).eq("id", runId);
        return new Response(JSON.stringify({ ok: true, processed: 0, run_id: runId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rows: any[] = [];
      for (const a of list!) {
        rows.push(await processOne(sb, a, casa, ano, idCol, nomeCol, partidoCol, ufCol, fotoCol));
      }
      for (let i = 0; i < rows.length; i += 50) {
        await sb.from("deputy_performance_scores").upsert(rows.slice(i, i + 50), {
          onConflict: "parlamentar_id,casa,ano",
        });
      }
      if (runId) await sb.from("sync_runs").update({ status: "ok", finished_at: new Date().toISOString(), summary: { processed: rows.length } }).eq("id", runId);
      return new Response(JSON.stringify({ ok: true, processed: rows.length, run_id: runId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSE streaming mode
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          send("start", { total, casa, ano, run_id: runId });
          await logEvent("start", `Iniciando: ${total} parlamentares (${casa}/${ano})`);
          if (total === 0) {
            send("done", { processed: 0 });
            await logEvent("done", "Nenhum parlamentar para processar");
            if (runId) await sb.from("sync_runs").update({ status: "ok", finished_at: new Date().toISOString() }).eq("id", runId);
            controller.close();
            return;
          }
          const rows: any[] = [];
          let i = 0;
          for (const a of list!) {
            i++;
            const t0 = Date.now();
            const row = await processOne(sb, a, casa, ano, idCol, nomeCol, partidoCol, ufCol, fotoCol);
            rows.push(row);
            const elapsed = Date.now() - t0;
            send("progress", {
              current: i,
              total,
              parlamentar_id: row.parlamentar_id,
              nome: row.nome,
              partido: row.partido,
              uf: row.uf,
              score_total: row.score_total,
              score_alinhamento: row.score_alinhamento,
              score_presenca: row.score_presenca,
              score_impacto: row.score_impacto,
              score_engajamento: row.score_engajamento,
              elapsed_ms: elapsed,
            });
            // Log every 10th to keep DB lean
            if (i % 10 === 0 || i === total) {
              await logEvent("progress", `${i}/${total} ${row.nome} (${row.partido}/${row.uf}) score=${row.score_total} ${elapsed}ms`);
            }
            // Flush upsert in batches of 25 for resilience
            if (rows.length % 25 === 0) {
              const batch = rows.slice(-25);
              await sb.from("deputy_performance_scores").upsert(batch, {
                onConflict: "parlamentar_id,casa,ano",
              });
              send("flush", { upserted: batch.length, accumulated: rows.length });
              await logEvent("flush", `Lote gravado: ${batch.length} (acumulado ${rows.length})`);
            }
          }
          // Final flush of remainder
          const remainder = rows.length % 25;
          if (remainder > 0) {
            const batch = rows.slice(-remainder);
            await sb.from("deputy_performance_scores").upsert(batch, {
              onConflict: "parlamentar_id,casa,ano",
            });
            send("flush", { upserted: batch.length, accumulated: rows.length });
            await logEvent("flush", `Lote final: ${batch.length}`);
          }
          send("done", { processed: rows.length });
          await logEvent("done", `Concluído: ${rows.length} processados`);
          if (runId) await sb.from("sync_runs").update({ status: "ok", finished_at: new Date().toISOString(), summary: { processed: rows.length } }).eq("id", runId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown";
          send("error", { message: msg });
          await logEvent("error", msg);
          if (runId) await sb.from("sync_runs").update({ status: "error", error: msg, finished_at: new Date().toISOString() }).eq("id", runId);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("calculate-performance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
