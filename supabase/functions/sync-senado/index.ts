import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/x/xml@6.0.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENADO_API = "https://legis.senado.leg.br/dadosabertos";

// Government coalition parties (Lula III - 2023-2026)
const GOV_COALITION = new Set([
  "PT", "MDB", "PSD", "UNIÃO", "PP", "PV", "PCdoB", "PDT", "PSB",
  "SOLIDARIEDADE", "REDE", "AVANTE", "REPUBLICANOS", "CIDADANIA",
  "PROS", "Federação Brasil da Esperança - Fe Brasil",
  "Federação PSDB CIDADANIA",
]);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isGovParty(sigla: string): boolean {
  if (!sigla) return false;
  return GOV_COALITION.has(sigla.trim());
}

function normalizeVoto(voto: string | null | undefined): string | null {
  if (!voto) return null;
  const v = voto.trim().toLowerCase();
  if (v === "sim" || v === "yes") return "sim";
  if (v === "não" || v === "nao" || v === "no") return "não";
  return null; // abstention, absence, etc. → not useful
}

interface SenadorVoto {
  codigoParlamentar: number;
  nomeParlamentar: string;
  siglaPartido: string;
  siglaUf: string;
  voto: string;
}

interface VotacaoSenado {
  codigoSessaoVotacao: string;
  dataSessao: string;
  descricaoVotacao: string;
  siglaMateria: string;
  numeroMateria: string;
  ementa: string;
  resultado: string;
  votacaoSecreta: string;
  votos: SenadorVoto[];
}

function asArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function parseVotacoes(xmlText: string): VotacaoSenado[] {
  const doc = parse(xmlText) as any;
  const sessoes = doc?.SessoesVotacao?.SessaoVotacao;
  if (!sessoes) return [];

  return asArray(sessoes).map((s: any) => {
    const votos: SenadorVoto[] = asArray(s.VotacaoParlamentar).map((vp: any) => ({
      codigoParlamentar: Number(vp.CodigoParlamentar),
      nomeParlamentar: String(vp.NomeParlamentar || ""),
      siglaPartido: String(vp.SiglaPartido || ""),
      siglaUf: String(vp.SiglaUf || ""),
      voto: String(vp.Voto || vp.DescricaoVoto || ""),
    }));

    return {
      codigoSessaoVotacao: String(s.CodigoSessaoVotacao),
      dataSessao: String(s.DataSessao || ""),
      descricaoVotacao: String(s.DescricaoVotacao || ""),
      siglaMateria: String(s.Sigla || ""),
      numeroMateria: String(s.Numero || ""),
      ementa: String(s.Ementa || ""),
      resultado: String(s.ResultadoVotacao || ""),
      votacaoSecreta: String(s.VotacaoSecreta || "N"),
      votos,
    };
  });
}

function determineGovPosition(votos: SenadorVoto[]): string | null {
  let govSim = 0;
  let govNao = 0;

  for (const v of votos) {
    if (!isGovParty(v.siglaPartido)) continue;
    const norm = normalizeVoto(v.voto);
    if (norm === "sim") govSim++;
    else if (norm === "não") govNao++;
  }

  const total = govSim + govNao;
  if (total < 3) return null; // Not enough votes to determine
  return govSim >= govNao ? "sim" : "não";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Authentication check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized: missing token" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    if (token === supabaseServiceKey) {
      // Authorized as service role
    } else {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Unauthorized: invalid token" }, 401);
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let year = new Date().getFullYear();
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        if (body?.ano) year = body.ano;
      }
    } catch { /* fallback to current year */ }

    console.log(`[sync-senado] Starting sync for year ${year}`);

    // ── STEP 1: Fetch voting sessions from Senate API ──
    // The API allows max 60-day ranges, so we fetch in chunks
    const allVotacoes: VotacaoSenado[] = [];
    const ITEMS_PER_PAGE = 50;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${SENADO_API}/votacao?ano=${year}&pagina=${page}&itens=${ITEMS_PER_PAGE}`;
      console.log(`[sync-senado] Fetching page ${page}: ${url}`);

      const res = await fetch(url, {
        headers: { "Accept": "application/xml" },
      });

      if (!res.ok) {
        console.error(`[sync-senado] API error: ${res.status}`);
        break;
      }

      const xmlText = await res.text();
      const votacoes = parseVotacoes(xmlText);
      console.log(`[sync-senado] Page ${page}: ${votacoes.length} votações`);

      if (votacoes.length === 0) {
        hasMore = false;
      } else {
        allVotacoes.push(...votacoes);
        if (votacoes.length < ITEMS_PER_PAGE) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // Safety: max 20 pages
      if (page > 20) break;
    }

    console.log(`[sync-senado] Total votações fetched: ${allVotacoes.length}`);

    // Filter to nominal votes only (skip secret votes)
    const nominalVotacoes = allVotacoes.filter((v) => v.votacaoSecreta !== "S");
    console.log(`[sync-senado] Nominal votações: ${nominalVotacoes.length}`);

    // ── STEP 2: Store votações and votos ──
    const senadorScores: Record<number, {
      aligned: number;
      relevant: number;
      nome: string;
      partido: string;
      uf: string;
    }> = {};

    let votacoesStored = 0;
    let votosStored = 0;

    for (const votacao of nominalVotacoes) {
      // Store votação metadata
      const votacaoRecord = {
        codigo_sessao_votacao: votacao.codigoSessaoVotacao,
        data: votacao.dataSessao || null,
        ano: year,
        descricao: votacao.descricaoVotacao || null,
        sigla_materia: votacao.siglaMateria || null,
        numero_materia: votacao.numeroMateria || null,
        ementa: votacao.ementa || null,
        resultado: votacao.resultado || null,
      };

      const { error: votErr } = await supabase
        .from("votacoes_senado")
        .upsert(votacaoRecord, { onConflict: "codigo_sessao_votacao" });
      if (votErr) console.error(`[sync-senado] Votação upsert error: ${votErr.message}`);
      else votacoesStored++;

      // Determine government position for this vote
      const govPosition = determineGovPosition(votacao.votos);

      // Store individual votes
      const votoBatch: any[] = [];
      for (const voto of votacao.votos) {
        if (!voto.codigoParlamentar) continue;

        const depId = voto.codigoParlamentar;
        if (!senadorScores[depId]) {
          senadorScores[depId] = {
            aligned: 0,
            relevant: 0,
            nome: voto.nomeParlamentar,
            partido: voto.siglaPartido,
            uf: voto.siglaUf,
          };
        }

        votoBatch.push({
          senador_id: depId,
          codigo_sessao_votacao: votacao.codigoSessaoVotacao,
          voto: voto.voto || "",
          ano: year,
        });

        // Calculate alignment
        const senNorm = normalizeVoto(voto.voto);
        if (senNorm && govPosition) {
          senadorScores[depId].relevant++;
          if (senNorm === govPosition) {
            senadorScores[depId].aligned++;
          }
        }
      }

      // Upsert votes in batches
      for (let i = 0; i < votoBatch.length; i += 500) {
        const slice = votoBatch.slice(i, i + 500);
        const { error: votoErr } = await supabase
          .from("votos_senadores")
          .upsert(slice, { onConflict: "senador_id,codigo_sessao_votacao" });
        if (votoErr) console.error(`[sync-senado] Voto upsert error: ${votoErr.message}`);
        else votosStored += slice.length;
      }
    }

    console.log(`[sync-senado] ${votacoesStored} votações, ${votosStored} votos stored`);

    // ── STEP 3: Fetch senator photos from list API ──
    const fotoMap: Record<number, string> = {};
    try {
      const listRes = await fetch(`${SENADO_API}/senador/lista/atual`, {
        headers: { "Accept": "application/json" },
      });
      if (listRes.ok) {
        const listJson = await listRes.json();
        const parlamentares = listJson?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];
        for (const p of asArray(parlamentares)) {
          const id = p?.IdentificacaoParlamentar?.CodigoParlamentar;
          const foto = p?.IdentificacaoParlamentar?.UrlFotoParlamentar;
          if (id && foto) fotoMap[Number(id)] = foto;
        }
      }
    } catch (e) {
      console.error(`[sync-senado] Error fetching senator photos: ${e.message}`);
    }

    // ── STEP 4: Classify and upsert analyses ──
    const records: any[] = [];
    for (const [idStr, data] of Object.entries(senadorScores)) {
      const score = data.relevant > 0 ? (data.aligned / data.relevant) * 100 : 0;
      let classificacao = "Centro";
      if (data.relevant === 0) classificacao = "Sem Dados";
      else if (score >= 70) classificacao = "Governo";
      else if (score <= 35) classificacao = "Oposição";

      records.push({
        senador_id: Number(idStr),
        senador_nome: data.nome,
        senador_partido: data.partido || null,
        senador_uf: data.uf || null,
        senador_foto: fotoMap[Number(idStr)] || null,
        ano: year,
        score: Math.round(score * 100) / 100,
        total_votos: data.relevant,
        votos_alinhados: data.aligned,
        classificacao,
      });
    }

    let upsertCount = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error: upsertError } = await supabase
        .from("analises_senadores")
        .upsert(chunk, { onConflict: "senador_id,ano" });
      if (upsertError) console.error(`[sync-senado] Analysis upsert error: ${upsertError.message}`);
      else upsertCount += chunk.length;
    }

    console.log(`[sync-senado] Done: ${upsertCount} senators analyzed, ${votacoesStored} votações, ${votosStored} votes`);

    return jsonResponse({
      analyzed: upsertCount,
      votacoes: votacoesStored,
      votos: votosStored,
      year,
    });
  } catch (error) {
    console.error("[sync-senado] Fatal error:", error.message, error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
});
