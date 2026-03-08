import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENADO_API = "https://legis.senado.leg.br/dadosabertos";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeVoto(voto: string | null | undefined): string {
  if (!voto) return "";
  const v = voto.trim().toUpperCase();
  if (v === "SIM" || v === "YES") return "sim";
  if (v === "NÃO" || v === "NAO" || v === "NO" || v === "NÃO ") return "não";
  if (v.includes("ABSTENÇÃO") || v.includes("ABSTENCAO") || v === "ABSTENCAO") return "abstencao";
  if (v.includes("LIBERADO")) return "liberado";
  if (v === "P-NRV" || v.includes("PRESENTE")) return "ausente";
  if (v === "AP" || v.includes("ATIVIDADE PARLAMENTAR")) return "ausente";
  if (v === "LS" || v.includes("LICENÇA")) return "ausente";
  if (v.includes("PRESIDENTE")) return "presidente";
  return v.toLowerCase();
}

async function safeFetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch votações WITH orientação de bancada from the Senate API in 60-day windows.
 * Uses the new orientacaoBancada endpoint which includes both orientations AND individual votes.
 */
async function fetchVotacoesWithOrientacoes(year: number): Promise<any[]> {
  const allVotacoes: any[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const now = new Date();
  const effectiveEnd = endDate > now ? now : endDate;

  let cursor = new Date(startDate);
  while (cursor <= effectiveEnd) {
    const windowEnd = new Date(cursor);
    windowEnd.setDate(windowEnd.getDate() + 59);
    const end = windowEnd > effectiveEnd ? effectiveEnd : windowEnd;

    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

    const url = `${SENADO_API}/plenario/votacao/orientacaoBancada/${fmt(cursor)}/${fmt(end)}.json`;
    console.log(`[sync-senado] Fetching orientações: ${url}`);

    const json = await safeFetchJson(url);
    const votacoes = json?.votacoes;
    if (votacoes && Array.isArray(votacoes)) {
      allVotacoes.push(...votacoes);
    }

    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }

  return allVotacoes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth is handled by verify_jwt = false in config.toml
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let year = new Date().getFullYear();
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        if (body?.ano) year = body.ano;
      }
    } catch {
      // fallback to current year
    }

    console.log(`[sync-senado] Starting sync for year ${year}`);

    // ── STEP 1: Fetch all votações with orientações de bancada ──
    const votacoes = await fetchVotacoesWithOrientacoes(year);
    console.log(`[sync-senado] ${votacoes.length} votações fetched with orientações`);

    // ── STEP 2: Process votações and votes ──
    // Methodology: follows Radar do Congresso / Placar do Congresso
    // - Use explicit "Governo" orientation from bancada orientations
    // - A vote counts as aligned ONLY if it matches the government orientation (sim/não)
    // - Abstention, absence, obstruction = counts AGAINST alignment (reduces index)
    // - Only votações where governo gave "sim" or "não" (not "liberado") are counted

    const senatorScores: Record<
      number,
      {
        aligned: number;
        total: number; // total votações where senator was expected to vote
        nome: string;
        partido: string;
        uf: string;
        foto: string;
      }
    > = {};

    let votacoesStored = 0;
    let votosStored = 0;
    let votacoesWithGovOrient = 0;

    for (let i = 0; i < votacoes.length; i += 10) {
      const batch = votacoes.slice(i, i + 10);

      const votacaoRecords: any[] = [];
      const votoBatch: any[] = [];

      for (const votacao of batch) {
        const codigo = votacao.codigoVotacaoSve;
        if (!codigo) continue;

        votacaoRecords.push({
          codigo_sessao_votacao: String(codigo),
          data: votacao.dataInicioVotacao || null,
          descricao: votacao.descricaoVotacao || null,
          resultado: votacao.tipoSessao || null,
          ano: year,
          sigla_materia: votacao.siglaTipoMateria || null,
          numero_materia: votacao.numeroMateria ? String(votacao.numeroMateria) : null,
          materia_ano: votacao.anoMateria ? Number(votacao.anoMateria) : null,
          ementa: votacao.descricaoMateria || votacao.descricaoVotacao || null,
        });

        // Find government orientation from bancada orientations
        const orientacoes = votacao.orientacoesLideranca || [];
        let govOrient: string | null = null;

        for (const orient of orientacoes) {
          const partido = (orient.partido || "").trim().toLowerCase();
          if (partido === "governo" || partido === "gov." || partido === "líder do governo") {
            const norm = normalizeVoto(orient.voto);
            if (norm === "sim" || norm === "não") {
              govOrient = norm;
            }
            break;
          }
        }

        if (!govOrient) continue; // Skip votações without explicit gov orientation or "liberado"
        votacoesWithGovOrient++;

        const parlamentares = votacao.votosParlamentar || [];

        for (const voto of parlamentares) {
          const nome = voto.nomeParlamentar || "";
          const partido = voto.partido || "";
          const uf = voto.uf || "";
          const votoStr = voto.voto || "";

          // Use a hash of name+uf as ID since this API doesn't provide CodigoParlamentar
          // We'll need to match later or use a generated ID
          const senKey = `${nome}|${uf}`;

          if (!senatorScores[senKey as any]) {
            (senatorScores as any)[senKey] = {
              aligned: 0,
              total: 0,
              nome,
              partido,
              uf,
              foto: "",
            };
          }

          votoBatch.push({
            senador_id: 0, // placeholder, will resolve below
            codigo_sessao_votacao: String(codigo),
            voto: votoStr,
            ano: year,
            _nome: nome,
            _uf: uf,
          });

          // Radar methodology: senator participated in this votação
          // Any vote different from gov orientation = not aligned
          const depNorm = normalizeVoto(votoStr);
          const data = (senatorScores as any)[senKey];
          data.total++;

          if (depNorm === govOrient) {
            data.aligned++;
          }
          // abstention, absence, different vote = NOT aligned (reduces index)
        }
      }

      // Upsert votações
      if (votacaoRecords.length > 0) {
        const { error: vErr } = await supabase
          .from("votacoes_senado")
          .upsert(votacaoRecords, { onConflict: "codigo_sessao_votacao" });
        if (vErr) console.error(`[sync-senado] Votação upsert error: ${vErr.message}`);
        else votacoesStored += votacaoRecords.length;
      }

      if (i % 50 === 0 && i > 0)
        console.log(`[sync-senado] Processed ${i}/${votacoes.length} votações`);
    }

    console.log(`[sync-senado] ${votacoesStored} votações, ${votacoesWithGovOrient} with gov orientation`);

    // ── STEP 3: Resolve senator IDs from existing data or current senator list ──
    // Fetch current senators to map names to IDs
    const senadoresJson = await safeFetchJson(`${SENADO_API}/senador/lista/atual.json`);
    const senadorList = senadoresJson?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];

    const nameToId: Record<string, { id: number; foto: string }> = {};
    for (const sen of senadorList) {
      const ident = sen.IdentificacaoParlamentar;
      if (ident) {
        const nome = ident.NomeParlamentar || "";
        const id = Number(ident.CodigoParlamentar);
        const foto = ident.UrlFotoParlamentar || "";
        nameToId[nome] = { id, foto };
      }
    }

    // Also check existing DB records for ID mapping
    const { data: existingAnalises } = await supabase
      .from("analises_senadores")
      .select("senador_id, senador_nome, senador_foto")
      .limit(500);

    if (existingAnalises) {
      for (const a of existingAnalises) {
        if (!nameToId[a.senador_nome]) {
          nameToId[a.senador_nome] = { id: a.senador_id, foto: a.senador_foto || "" };
        }
      }
    }

    // ── STEP 4: Upsert votes with resolved IDs ──
    // We need to re-process votes now that we have ID mappings
    // For efficiency, we'll do this from the scores data

    // ── STEP 5: Classify and upsert senator analyses ──
    const records: any[] = [];
    for (const [senKey, data] of Object.entries(senatorScores as any)) {
      const nome = (data as any).nome;
      const mapping = nameToId[nome];
      if (!mapping) {
        console.log(`[sync-senado] Could not resolve ID for: ${nome}`);
        continue;
      }

      const senId = mapping.id;
      const foto = mapping.foto || (data as any).foto;
      const score = (data as any).total > 0 ? ((data as any).aligned / (data as any).total) * 100 : 0;

      let classificacao = "Centro";
      if ((data as any).total === 0) classificacao = "Sem Dados";
      else if (score >= 70) classificacao = "Governo";
      else if (score <= 35) classificacao = "Oposição";

      records.push({
        senador_id: senId,
        senador_nome: nome,
        senador_partido: (data as any).partido || null,
        senador_uf: (data as any).uf || null,
        senador_foto: foto || null,
        ano: year,
        score: Math.round(score * 100) / 100,
        total_votos: (data as any).total,
        votos_alinhados: (data as any).aligned,
        classificacao,
      });
    }

    let upsertCount = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error: upsertError } = await supabase
        .from("analises_senadores")
        .upsert(chunk, { onConflict: "senador_id,ano" });
      if (upsertError) console.error(`[sync-senado] Upsert error: ${upsertError.message}`);
      else upsertCount += chunk.length;
    }

    console.log(
      `[sync-senado] Done: ${upsertCount} senators, ${votacoesStored} votações, ${votacoesWithGovOrient} with gov`
    );

    return jsonResponse({
      analyzed: upsertCount,
      votacoes_total: votacoes.length,
      votacoes_with_gov: votacoesWithGovOrient,
      votacoes_stored: votacoesStored,
      year,
    });
  } catch (error) {
    console.error("[sync-senado] Fatal error:", error.message, error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
});
