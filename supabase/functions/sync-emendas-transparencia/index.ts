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
  tentarAnoAnterior: z.boolean().default(true),
  // Faixa para varredura multi-ano. Se anoFim>anoInicio, ignora "ano" e itera.
  anoInicio: z.number().int().min(2014).max(2100).optional(),
  anoFim: z.number().int().min(2014).max(2100).optional(),
});

type RawEmenda = Record<string, unknown>;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------- Cache + Quota helpers ----------
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function cacheGet(sb: any, key: string): Promise<unknown | null> {
  const { data } = await sb.from("sync_query_cache").select("response,expires_at,id,hit_count").eq("cache_key", key).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  await sb.from("sync_query_cache").update({ hit_count: (data.hit_count || 0) + 1 }).eq("id", data.id);
  return data.response;
}

async function cacheSet(sb: any, key: string, endpoint: string, params: Record<string, unknown>, response: unknown, ttlHours: number) {
  const expires = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  await sb.from("sync_query_cache").upsert({ cache_key: key, endpoint, params, response, expires_at: expires, hit_count: 0 }, { onConflict: "cache_key" });
}

async function checkAndIncQuota(sb: any): Promise<{ ok: boolean; used: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  // Get or create today's row
  const { data: existing } = await sb.from("portal_api_quota").select("*").eq("date", today).maybeSingle();
  const limit = existing?.daily_limit ?? 600;
  const used = existing?.requests_used ?? 0;
  if (used >= limit) return { ok: false, used, limit };
  await sb.from("portal_api_quota").upsert(
    { date: today, requests_used: used + 1, daily_limit: limit, updated_at: new Date().toISOString() },
    { onConflict: "date" }
  );
  return { ok: true, used: used + 1, limit };
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

type FetchOpts = { ttlHours?: number; timeoutMs?: number };
type FetchResult = { data: unknown; fromCache: boolean; latencyMs: number };

async function fetchPortal(
  sb: any,
  path: string,
  apiKey: string,
  params: Record<string, string | number | undefined>,
  log: (step: string, msg: string) => Promise<void>,
  opts: FetchOpts = {}
): Promise<FetchResult> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && String(v).trim()) url.searchParams.set(k, String(v));

  const cleanParams: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && String(v).trim()) cleanParams[k] = v;
  const cacheKey = await sha256(`${path}::${JSON.stringify(cleanParams)}`);

  // Cache lookup
  const cached = await cacheGet(sb, cacheKey);
  if (cached !== null) {
    await log("cache_hit", `Cache: ${path} (${url.search}) — sem consumir cota.`);
    return { data: cached, fromCache: true, latencyMs: 0 };
  }

  // Quota check before real fetch
  const quota = await checkAndIncQuota(sb);
  if (!quota.ok) {
    throw new Error(`Limite diário do Portal da Transparência atingido (${quota.used}/${quota.limit}). Tente após 00:00 (Brasília) ou aumente o limite no painel admin.`);
  }

  const timeoutMs = opts.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  let r: Response;
  try {
    r = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "Monitor-Legislativo/1.0", "chave-api-dados": apiKey } });
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === "AbortError") throw new Error(`Timeout (${timeoutMs}ms) ao buscar ${path}. Considere reduzir páginas.`);
    throw e;
  }
  clearTimeout(timeout);
  const latencyMs = Date.now() - t0;
  const body = await r.text();
  if (r.status === 429) throw new Error("Portal retornou 429 (rate limit). Aguarde alguns minutos.");
  if (!r.ok) throw new Error(`Portal da Transparência HTTP ${r.status}: ${body.slice(0, 300)}`);
  if (!body.trim()) {
    await cacheSet(sb, cacheKey, path, cleanParams, [], opts.ttlHours ?? 6);
    return { data: [], fromCache: false, latencyMs };
  }
  if (!body.trim().startsWith("[") && !body.trim().startsWith("{")) {
    throw new Error(`Portal retornou resposta não JSON para ${url.pathname}. Trecho: ${body.slice(0, 160)}`);
  }
  const parsed = JSON.parse(body);
  await cacheSet(sb, cacheKey, path, cleanParams, parsed, opts.ttlHours ?? 6);
  return { data: parsed, fromCache: false, latencyMs };
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

    async function fetchYear(targetAno: number) {
      const acc: RawEmenda[] = [];
      let maxPaginas = body.paginas;
      let cacheHits = 0;
      for (let pagina = 1; pagina <= maxPaginas; pagina++) {
        await log("portal", `Buscando página ${pagina}/${maxPaginas} (ano ${targetAno}) no Portal...`);
        const res = await fetchPortal(sb, "/emendas", apiKey, { pagina, ano: targetAno, tipoEmenda: body.tipoEmenda, nomeAutor: body.nomeAutor, codigoFuncao: body.codigoFuncao, codigoSubfuncao: body.codigoSubfuncao }, log, { ttlHours: 6, timeoutMs: 15000 });
        const arr = Array.isArray(res.data) ? (res.data as RawEmenda[]) : [];
        acc.push(...arr);
        if (res.fromCache) cacheHits++;
        await log("portal", `Ano ${targetAno} pág ${pagina}: ${arr.length} registros (${res.fromCache ? "cache" : `${res.latencyMs}ms`}).`);
        if (!res.fromCache && res.latencyMs > 5000 && pagina < maxPaginas) {
          const novoMax = pagina + Math.max(1, Math.floor((maxPaginas - pagina) / 2));
          if (novoMax < maxPaginas) {
            await log("adaptive", `Latência alta (${res.latencyMs}ms). Reduzindo de ${maxPaginas} para ${novoMax} páginas para manter o sync.`);
            maxPaginas = novoMax;
          }
        }
        if (arr.length === 0) break;
      }
      return { acc, cacheHits, maxPaginas };
    }

    let anoUsado = body.ano;
    let { acc: fetched, cacheHits } = await fetchYear(body.ano);
    let emptyReason: string | null = null;
    let fallbackUsado = false;
    if (fetched.length === 0 && body.tentarAnoAnterior && !body.nomeAutor) {
      const anoFallback = body.ano - 1;
      await log("fallback", `Portal retornou 0 registros para ${body.ano}. Tentando automaticamente ${anoFallback}...`);
      const r = await fetchYear(anoFallback);
      if (r.acc.length > 0) {
        fetched = r.acc;
        cacheHits += r.cacheHits;
        anoUsado = anoFallback;
        fallbackUsado = true;
        await log("fallback", `Fallback bem-sucedido: ${r.acc.length} emendas em ${anoFallback}.`);
      } else {
        emptyReason = `O Portal da Transparência ainda não publicou emendas executadas para ${body.ano} nem para ${anoFallback}. Tente um ano anterior ou aguarde a próxima atualização do governo.`;
        await log("vazio", emptyReason);
      }
    } else if (fetched.length === 0) {
      emptyReason = `O Portal da Transparência não retornou emendas para ${body.ano}${body.nomeAutor ? ` (autor: ${body.nomeAutor})` : ""}. Pode estar fora do período de execução publicado.`;
      await log("vazio", emptyReason);
    }
    if (cacheHits > 0) await log("cache_summary", `${cacheHits} páginas vieram do cache.`);

    const unique = Array.from(new Map(fetched.map((e) => [text(e.codigoEmenda) || `${text(e.numeroEmenda)}-${anoUsado}-${text(e.nomeAutor)}`, e])).values());
    await log("dedupe", `${unique.length} emendas únicas serão classificadas por IA.`);
    const classified = await classify(unique);
    await log("ia", "Classificação temática por IA concluída.");

    const names = unique.map((e) => normalizeName(text(e.nomeAutor || e.autor))).filter(Boolean);
    const [deps, sens] = await Promise.all([
      sb.from("analises_deputados").select("deputado_id,deputado_nome,deputado_partido,deputado_uf").eq("ano", anoUsado).limit(700),
      sb.from("analises_senadores").select("senador_id,senador_nome,senador_partido,senador_uf").eq("ano", anoUsado).limit(100),
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
        try {
          const r = await fetchPortal(sb, `/emendas/documentos/${encodeURIComponent(text(e.codigoEmenda))}`, apiKey, { pagina: 1 }, log, { ttlHours: 24, timeoutMs: 12000 });
          documentos = Array.isArray(r.data) ? r.data : [];
        } catch { documentos = []; }
      }
      rows.push({
        codigo_emenda: text(e.codigoEmenda) || `${text(e.numeroEmenda)}-${anoUsado}-${text(e.nomeAutor)}`,
        ano: Number(e.ano || anoUsado), tipo_emenda: text(e.tipoEmenda) || "Não informado", numero_emenda: text(e.numeroEmenda) || null,
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
    await log("concluido", emptyReason ? `Sync concluído sem dados: ${emptyReason}` : `${rows.length} emendas gravadas/atualizadas (ano efetivo: ${anoUsado}).`);
    await sb.from("sync_runs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      summary: { fetched: fetched.length, upserted: rows.length, ano_solicitado: body.ano, ano_usado: anoUsado, fallback_usado: fallbackUsado, empty_reason: emptyReason },
    }).eq("id", runId);
    return response({ ok: true, fetched: fetched.length, upserted: rows.length, ano_solicitado: body.ano, ano_usado: anoUsado, fallback_usado: fallbackUsado, empty_reason: emptyReason, runId });
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
