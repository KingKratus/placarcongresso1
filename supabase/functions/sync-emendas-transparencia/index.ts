import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
const TEMAS = "Saúde, Segurança, Educação, Infraestrutura, Assistência Social, Agropecuária, Meio Ambiente, Economia, Desenvolvimento Regional, Esporte, Cultura, Ciência e Tecnologia, Defesa Civil, Habitação, Saneamento, Outros";

const BodySchema = z.object({
  ano: z.number().int().min(2014).max(2100).default(new Date().getFullYear()),
  tipoEmenda: z.string().trim().max(80).optional(),
  nomeAutor: z.string().trim().max(140).optional(),
  codigoFuncao: z.string().trim().max(20).optional(),
  codigoSubfuncao: z.string().trim().max(20).optional(),
  paginas: z.number().int().min(1).max(10).default(3),
  incluirDocumentos: z.boolean().default(false),
});

type RawEmenda = Record<string, unknown>;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function money(value: unknown) {
  const s = String(value ?? "0").replace(/\s/g, "").replace(/R\$/g, "");
  if (!s) return 0;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function text(v: unknown) { return String(v ?? "").trim(); }
function estagio(e: RawEmenda) {
  const empenhado = money(e.valorEmpenhado), liquidado = money(e.valorLiquidado), pago = money(e.valorPago) + money(e.valorRestoPago);
  if (pago > 0) return "Paga";
  if (liquidado > 0) return "Liquidada";
  if (empenhado > 0) return "Empenhada";
  return "Planejada";
}
function risco(e: RawEmenda) {
  const empenhado = money(e.valorEmpenhado), pago = money(e.valorPago) + money(e.valorRestoPago), cancelado = money(e.valorRestoCancelado);
  if (empenhado > 0 && pago / empenhado < 0.1) return "Alto";
  if (cancelado > 0 || (empenhado > 0 && pago / empenhado < 0.45)) return "Médio";
  return "Baixo";
}
function ufFromLocalidade(s: string) {
  const m = s.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  return m?.[1]?.toUpperCase() || null;
}
function normalizeName(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchPortal(path: string, apiKey: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && String(v).trim()) url.searchParams.set(k, String(v));
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Monitor-Legislativo/1.0", "chave-api-dados": apiKey } });
  const body = await r.text();
  if (!r.ok) throw new Error(`Portal da Transparência HTTP ${r.status}: ${body.slice(0, 300)}`);
  if (!body.trim()) return [];
  if (!body.trim().startsWith("[") && !body.trim().startsWith("{")) {
    throw new Error(`Portal da Transparência retornou uma resposta não JSON para ${url.pathname}. Confira a chave/API ou tente novamente. Trecho: ${body.slice(0, 160)}`);
  }
  return JSON.parse(body);
}

async function classify(rows: RawEmenda[]) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key || rows.length === 0) return {} as Record<number, any>;
  const out: Record<number, any> = {};
  for (let start = 0; start < rows.length; start += 20) {
    const batch = rows.slice(start, start + 20);
    const prompt = batch.map((e, i) => `${i + 1}. Código ${text(e.codigoEmenda)} | ${text(e.tipoEmenda)} | Autor: ${text(e.nomeAutor || e.autor)} | Função: ${text(e.funcao)} | Subfunção: ${text(e.subfuncao)} | Local: ${text(e.localidadeDoGasto)} | Empenhado: ${text(e.valorEmpenhado)} | Pago: ${text(e.valorPago)} ${text(e.valorRestoPago)}`).join("\n");
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `Classifique emendas parlamentares orçamentárias brasileiras. Temas: ${TEMAS}. Responda somente JSON: {"1":{"tema":"...","subtema":"...","area_publica":"...","publico_beneficiado":"...","resumo":"frase objetiva com destino/execução","confianca":0.0}}` },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!r.ok) continue;
      const json = await r.json();
      const content = json.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]);
      for (const [k, v] of Object.entries(parsed)) out[start + Number(k) - 1] = v;
    } catch (e) { console.error("classify transparencia error", e); }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let sb: ReturnType<typeof createClient> | null = null;
  let runId: string | null = null;
  const log = async (step: string, message: string) => {
    if (!sb || !runId) return;
    await sb.from("sync_run_events").insert({ run_id: runId, step, message });
  };
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const sbUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await sbUser.auth.getClaims(token);
    if (!claims?.claims?.sub) return response({ error: "Faça login para sincronizar emendas orçamentárias." }, 401);

    const apiKey = Deno.env.get("PORTAL_TRANSPARENCIA_API_KEY");
    if (!apiKey) return response({ error: "Chave do Portal da Transparência não configurada." }, 500);
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return response({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;

    sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: run, error: runError } = await sb.from("sync_runs").insert({ casa: "emendas_orcamentarias", ano: body.ano, user_id: claims.claims.sub, status: "running" }).select("id").single();
    if (runError) throw runError;
    runId = run.id;
    await log("inicio", `Sync iniciado para ${body.ano}${body.nomeAutor ? ` · autor: ${body.nomeAutor}` : ""}.`);

    const fetched: RawEmenda[] = [];
    for (let pagina = 1; pagina <= body.paginas; pagina++) {
      await log("portal", `Buscando página ${pagina}/${body.paginas} no Portal da Transparência...`);
      const page = await fetchPortal("/emendas", apiKey, { pagina, ano: body.ano, tipoEmenda: body.tipoEmenda, nomeAutor: body.nomeAutor, codigoFuncao: body.codigoFuncao, codigoSubfuncao: body.codigoSubfuncao });
      const arr = Array.isArray(page) ? page : [];
      fetched.push(...arr);
      await log("portal", `Página ${pagina}: ${arr.length} registros retornados.`);
      if (arr.length === 0) break;
    }

    const unique = Array.from(new Map(fetched.map((e) => [text(e.codigoEmenda) || `${text(e.numeroEmenda)}-${body.ano}-${text(e.nomeAutor)}`, e])).values());
    await log("dedupe", `${unique.length} emendas únicas serão classificadas por IA.`);
    const classified = await classify(unique);
    await log("ia", "Classificação temática por IA concluída.");

    const names = unique.map((e) => normalizeName(text(e.nomeAutor || e.autor))).filter(Boolean);
    const [deps, sens] = await Promise.all([
      sb.from("analises_deputados").select("deputado_id,deputado_nome,deputado_partido,deputado_uf").eq("ano", body.ano).limit(700),
      sb.from("analises_senadores").select("senador_id,senador_nome,senador_partido,senador_uf").eq("ano", body.ano).limit(100),
    ]);
    const people = [
      ...(deps.data || []).map((d: any) => ({ id: d.deputado_id, casa: "camara", nome: d.deputado_nome, partido: d.deputado_partido, uf: d.deputado_uf, key: normalizeName(d.deputado_nome) })),
      ...(sens.data || []).map((s: any) => ({ id: s.senador_id, casa: "senado", nome: s.senador_nome, partido: s.senador_partido, uf: s.senador_uf, key: normalizeName(s.senador_nome) })),
    ];

    const rows = [];
    for (let i = 0; i < unique.length; i++) {
      const e = unique[i];
      const c = classified[i] || {};
      const authorKey = normalizeName(text(e.nomeAutor || e.autor));
      const person = people.find((p) => p.key === authorKey || authorKey.includes(p.key) || p.key.includes(authorKey));
      let documentos: unknown[] = [];
      if (body.incluirDocumentos && text(e.codigoEmenda)) {
        try { documentos = await fetchPortal(`/emendas/documentos/${encodeURIComponent(text(e.codigoEmenda))}`, apiKey, { pagina: 1 }); } catch { documentos = []; }
      }
      rows.push({
        codigo_emenda: text(e.codigoEmenda) || `${text(e.numeroEmenda)}-${body.ano}-${text(e.nomeAutor)}`,
        ano: Number(e.ano || body.ano), tipo_emenda: text(e.tipoEmenda) || "Não informado", numero_emenda: text(e.numeroEmenda) || null,
        autor: text(e.autor) || null, nome_autor: text(e.nomeAutor || e.autor) || null,
        parlamentar_id: person?.id || null, casa: person?.casa || null, partido: person?.partido || null, uf: person?.uf || ufFromLocalidade(text(e.localidadeDoGasto)),
        localidade_gasto: text(e.localidadeDoGasto) || null, funcao: text(e.funcao) || null, subfuncao: text(e.subfuncao) || null,
        valor_empenhado: money(e.valorEmpenhado), valor_liquidado: money(e.valorLiquidado), valor_pago: money(e.valorPago), valor_resto_inscrito: money(e.valorRestoInscrito), valor_resto_cancelado: money(e.valorRestoCancelado), valor_resto_pago: money(e.valorRestoPago),
        documentos, tema_ia: c.tema || text(e.funcao) || "Outros", subtema_ia: c.subtema || text(e.subfuncao) || null, area_publica: c.area_publica || null, publico_beneficiado: c.publico_beneficiado || null,
        risco_execucao: ["Baixo", "Médio", "Alto"].includes(risco(e)) ? risco(e) : "Médio", estagio_execucao: estagio(e), resumo_ia: c.resumo || null, confianca_ia: Math.max(0, Math.min(1, Number(c.confianca || 0.55))),
        raw_data: e, fetched_at: new Date().toISOString(),
      });
    }

    for (let i = 0; i < rows.length; i += 100) {
      await log("gravacao", `Gravando lote ${Math.floor(i / 100) + 1} (${Math.min(i + 100, rows.length)}/${rows.length}).`);
      const { error } = await sb.from("emendas_orcamentarias_transparencia").upsert(rows.slice(i, i + 100), { onConflict: "codigo_emenda" });
      if (error) throw error;
    }
    await log("concluido", `${rows.length} emendas gravadas/atualizadas.`);
    await sb.from("sync_runs").update({ status: "completed", finished_at: new Date().toISOString(), summary: { fetched: fetched.length, upserted: rows.length, ano: body.ano } }).eq("id", runId);
    return response({ ok: true, fetched: fetched.length, upserted: rows.length, ano: body.ano, runId });
  } catch (e) {
    console.error("sync-emendas-transparencia error", e);
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    if (sb && runId) {
      await sb.from("sync_run_events").insert({ run_id: runId, step: "error", message });
      await sb.from("sync_runs").update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", runId);
    }
    return response({ error: message, runId }, 500);
  }
});
