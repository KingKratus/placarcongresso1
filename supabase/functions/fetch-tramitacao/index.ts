import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Busca a tramitação completa de uma proposição legislativa
 * (Câmara via dadosabertos.camara.leg.br v2, Senado via legis.senado.leg.br).
 *
 * Body:
 *   { casa: "camara"|"senado", tipo: string, numero: string, ano: number, force?: boolean }
 *
 * Retorna:
 *   { tramitacao: { casa, tipo, numero, ano, ementa, ultima_situacao, eventos: [...] }, source: "cache"|"api" }
 *
 * Eventos: { data, descricao, situacao, orgao, despacho, url? }
 */

const CACHE_TTL_HOURS = 24;

interface Evento {
  data: string | null;
  descricao: string;
  situacao: string | null;
  orgao: string | null;
  despacho: string | null;
  url: string | null;
}

interface TramitacaoResult {
  casa: "camara" | "senado";
  tipo: string;
  numero: string;
  ano: number;
  ementa: string | null;
  ultima_situacao: string | null;
  ultima_atualizacao: string | null;
  proposicao_id_externo: string | null;
  eventos: Evento[];
}

async function fetchCamaraTramitacao(tipo: string, numero: string, ano: number): Promise<TramitacaoResult | null> {
  // 1. Find proposition id by tipo/numero/ano
  const searchUrl = `https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=${encodeURIComponent(tipo)}&numero=${encodeURIComponent(numero)}&ano=${ano}&itens=5`;
  const searchResp = await fetch(searchUrl, { headers: { Accept: "application/json" } });
  if (!searchResp.ok) return null;
  const searchJson = await searchResp.json();
  const dados = searchJson?.dados || [];
  if (dados.length === 0) return null;
  const prop = dados[0];
  const id = prop.id;

  // 2. Fetch full detail (ementa + situação atual)
  let ementa: string | null = prop.ementa || null;
  let ultimaSituacao: string | null = null;
  let ultimaAtualizacao: string | null = null;
  try {
    const detailResp = await fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}`, { headers: { Accept: "application/json" } });
    if (detailResp.ok) {
      const detailJson = await detailResp.json();
      const d = detailJson?.dados;
      ementa = d?.ementa || ementa;
      ultimaSituacao = d?.statusProposicao?.descricaoSituacao || null;
      ultimaAtualizacao = d?.statusProposicao?.dataHora || null;
    }
  } catch (_) { /* keep defaults */ }

  // 3. Fetch tramitações
  const tramResp = await fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}/tramitacoes`, { headers: { Accept: "application/json" } });
  if (!tramResp.ok) return null;
  const tramJson = await tramResp.json();
  const tramitacoes: any[] = tramJson?.dados || [];

  const eventos: Evento[] = tramitacoes.map((t) => ({
    data: t.dataHora || null,
    descricao: t.descricaoTramitacao || t.descricaoSituacao || "Tramitação",
    situacao: t.descricaoSituacao || null,
    orgao: t.siglaOrgao || null,
    despacho: t.despacho || null,
    url: null,
  }));

  // Sort by date asc
  eventos.sort((a, b) => {
    if (!a.data) return -1;
    if (!b.data) return 1;
    return a.data.localeCompare(b.data);
  });

  return {
    casa: "camara",
    tipo,
    numero,
    ano,
    ementa,
    ultima_situacao: ultimaSituacao,
    ultima_atualizacao: ultimaAtualizacao,
    proposicao_id_externo: String(id),
    eventos,
  };
}

async function fetchSenadoTramitacao(tipo: string, numero: string, ano: number): Promise<TramitacaoResult | null> {
  // Senado: lookup matéria pelo tipo/número/ano
  const lookupUrl = `https://legis.senado.leg.br/dadosabertos/materia/${encodeURIComponent(tipo)}/${encodeURIComponent(numero)}/${ano}?v=6`;
  const lookupResp = await fetch(lookupUrl, { headers: { Accept: "application/json" } });
  if (!lookupResp.ok) return null;
  const lookupJson = await lookupResp.json();
  const detalhe = lookupJson?.DetalheMateria?.Materia;
  if (!detalhe) return null;

  const codigoMateria = detalhe?.IdentificacaoMateria?.CodigoMateria;
  if (!codigoMateria) return null;
  const ementa = detalhe?.DadosBasicosMateria?.EmentaMateria || null;

  // Movimentações
  const movUrl = `https://legis.senado.leg.br/dadosabertos/materia/movimentacoes/${codigoMateria}?v=5`;
  const movResp = await fetch(movUrl, { headers: { Accept: "application/json" } });
  let eventos: Evento[] = [];
  let ultimaSituacao: string | null = null;
  let ultimaAtualizacao: string | null = null;

  if (movResp.ok) {
    const movJson = await movResp.json();
    const informes =
      movJson?.MovimentacaoMateria?.Materia?.Movimentacoes?.InformesLegislativos?.InformeLegislativo ||
      movJson?.MovimentacaoMateria?.Materia?.Movimentacoes?.InformeLegislativo ||
      [];
    const arr = Array.isArray(informes) ? informes : [informes];

    eventos = arr
      .filter((i: any) => i)
      .map((i: any) => ({
        data: i?.Data || i?.DataInformacao || null,
        descricao: i?.Descricao || i?.TextoTramitacao || i?.Despacho || "Tramitação",
        situacao: i?.SituacaoIniciada || i?.Situacao || null,
        orgao: i?.OrigemInformacao?.SiglaCasaOrigem || i?.LocalAtual || null,
        despacho: i?.Despacho || null,
        url: null,
      }));

    eventos.sort((a, b) => {
      if (!a.data) return -1;
      if (!b.data) return 1;
      return a.data.localeCompare(b.data);
    });

    if (eventos.length > 0) {
      const last = eventos[eventos.length - 1];
      ultimaSituacao = last.situacao || last.descricao;
      ultimaAtualizacao = last.data;
    }
  }

  // Situação atual oficial (se disponível)
  const situacaoAtual = detalhe?.SituacaoAtual?.Autuacoes?.Autuacao;
  if (situacaoAtual) {
    const sa = Array.isArray(situacaoAtual) ? situacaoAtual[0] : situacaoAtual;
    ultimaSituacao = sa?.Situacao?.DescricaoSituacao || ultimaSituacao;
  }

  return {
    casa: "senado",
    tipo,
    numero,
    ano,
    ementa,
    ultima_situacao: ultimaSituacao,
    ultima_atualizacao: ultimaAtualizacao,
    proposicao_id_externo: String(codigoMateria),
    eventos,
  };
}

function isCacheFresh(fetchedAt: string): boolean {
  const age = Date.now() - new Date(fetchedAt).getTime();
  return age < CACHE_TTL_HOURS * 3600 * 1000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const casa = String(body?.casa || "").toLowerCase();
    const tipo = String(body?.tipo || "").trim();
    const numero = String(body?.numero || "").trim();
    const ano = Number(body?.ano);
    const force = !!body?.force;

    if (!["camara", "senado"].includes(casa) || !tipo || !numero || !ano) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios: casa, tipo, numero, ano" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, serviceKey);

    // 1. Cache lookup
    if (!force) {
      const { data: cached } = await sb
        .from("tramitacoes_cache")
        .select("*")
        .eq("casa", casa).eq("tipo", tipo).eq("numero", numero).eq("ano", ano)
        .maybeSingle();
      if (cached && isCacheFresh(cached.fetched_at)) {
        return new Response(JSON.stringify({
          tramitacao: {
            casa: cached.casa, tipo: cached.tipo, numero: cached.numero, ano: cached.ano,
            ementa: cached.ementa, ultima_situacao: cached.ultima_situacao,
            ultima_atualizacao: cached.ultima_atualizacao,
            proposicao_id_externo: cached.proposicao_id_externo,
            eventos: cached.eventos || [],
          },
          source: "cache",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 2. Fetch from API
    const result = casa === "camara"
      ? await fetchCamaraTramitacao(tipo, numero, ano)
      : await fetchSenadoTramitacao(tipo, numero, ano);

    if (!result) {
      return new Response(JSON.stringify({ error: "Proposição não encontrada na API oficial" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Upsert cache
    await sb.from("tramitacoes_cache").upsert({
      casa: result.casa,
      tipo: result.tipo,
      numero: result.numero,
      ano: result.ano,
      proposicao_id_externo: result.proposicao_id_externo,
      ementa: result.ementa,
      eventos: result.eventos,
      ultima_situacao: result.ultima_situacao,
      ultima_atualizacao: result.ultima_atualizacao,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "casa,tipo,numero,ano" });

    return new Response(JSON.stringify({ tramitacao: result, source: "api" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-tramitacao error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});