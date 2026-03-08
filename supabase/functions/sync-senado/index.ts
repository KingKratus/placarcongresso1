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
  const v = voto.trim().toLowerCase();
  if (v === "sim" || v === "yes") return "sim";
  if (v === "não" || v === "nao" || v === "no") return "não";
  if (v.includes("abstenção") || v.includes("abstencao")) return "abstencao";
  if (v.includes("p-nrv") || v.includes("presente")) return "ausente";
  if (v.includes("ap") || v.includes("atividade parlamentar")) return "ausente";
  if (v.includes("ls") || v.includes("licença")) return "ausente";
  if (v.includes("presidente")) return "";
  return v;
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
 * Fetch votações from the Senate API in 60-day windows for a given year.
 * The API endpoint /plenario/lista/votacao/{inicio}/{fim} supports max 60 days.
 * Returns all votações with inline votes.
 */
async function fetchVotacoesForYear(year: number): Promise<any[]> {
  const allVotacoes: any[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const now = new Date();
  const effectiveEnd = endDate > now ? now : endDate;

  let cursor = new Date(startDate);
  while (cursor <= effectiveEnd) {
    const windowEnd = new Date(cursor);
    windowEnd.setDate(windowEnd.getDate() + 59); // 60-day window
    const end = windowEnd > effectiveEnd ? effectiveEnd : windowEnd;

    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

    const url = `${SENADO_API}/plenario/lista/votacao/${fmt(cursor)}/${fmt(end)}.json`;
    console.log(`[sync-senado] Fetching: ${url}`);

    const json = await safeFetchJson(url);
    const votacoes = json?.ListaVotacoes?.Votacoes?.Votacao;
    if (votacoes) {
      const arr = Array.isArray(votacoes) ? votacoes : [votacoes];
      allVotacoes.push(...arr);
    }

    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }

  return allVotacoes;
}

/**
 * Fetch government leader info from leadership endpoint.
 * Returns array of CodigoParlamentar for government leaders.
 */
async function fetchGovLeaderIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const json = await safeFetchJson(`${SENADO_API}/composicao/lideranca.json`);

  try {
    // The API returns a flat array of leadership records
    const arr = Array.isArray(json) ? json : [];

    for (const lid of arr) {
      const casa = (lid?.casa || "").toUpperCase();
      const unidade = (lid?.descricaoTipoUnidadeLideranca || "").toLowerCase();
      const tipo = (lid?.siglaTipoLideranca || "").toUpperCase();

      // Only Senate government leaders (not vice-leaders, not Câmara, not Congresso)
      if (
        casa === "SF" &&
        unidade.includes("governo") &&
        tipo === "L" // L = Líder (not V = Vice-líder)
      ) {
        const codigo = lid?.codigoParlamentar;
        if (codigo) ids.add(String(codigo));
      }
    }
  } catch (e) {
    console.error("[sync-senado] Error parsing lideranca:", e);
  }

  // Fallback: Jaques Wagner (known government leader since 2023)
  if (ids.size === 0) {
    ids.add("581");
    console.log("[sync-senado] Using fallback government leader: Jaques Wagner (581)");
  }

  console.log(`[sync-senado] Found ${ids.size} government leader IDs: ${[...ids].join(", ")}`);
  return ids;
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
      const { data: claimsData, error: claimsError } =
        await authClient.auth.getClaims(token);

      if (claimsError || !claimsData?.claims) {
        return jsonResponse({ error: "Unauthorized: invalid token" }, 401);
      }

      if (claimsData.claims.role !== "authenticated") {
        return jsonResponse({ error: "Unauthorized: insufficient permissions" }, 403);
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
    } catch {
      // fallback to current year
    }

    console.log(`[sync-senado] Starting sync for year ${year}`);

    // ── STEP 1: Fetch government leader IDs ──
    const govLeaderIds = await fetchGovLeaderIds();

    // ── STEP 2: Fetch all votações for the year ──
    const votacoes = await fetchVotacoesForYear(year);
    console.log(`[sync-senado] ${votacoes.length} votações fetched`);

    // ── STEP 3: Process votações and votes ──
    const senatorScores: Record<
      number,
      {
        aligned: number;
        relevant: number;
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
        const codigo = votacao.CodigoSessaoVotacao;
        if (!codigo) continue;

        votacaoRecords.push({
          codigo_sessao_votacao: String(codigo),
          data: votacao.DataSessao || null,
          descricao: votacao.DescricaoVotacao || null,
          resultado: votacao.Resultado || null,
          ano: year,
          sigla_materia: votacao.SiglaMateria || null,
          numero_materia: votacao.NumeroMateria ? String(votacao.NumeroMateria) : null,
          materia_ano: votacao.AnoMateria ? Number(votacao.AnoMateria) : null,
          ementa: votacao.DescricaoIdentificacaoMateria || null,
        });

        const parlamentares = votacao.Votos?.VotoParlamentar;
        if (!parlamentares) continue;
        const votos = Array.isArray(parlamentares) ? parlamentares : [parlamentares];

        // Find government leader's vote for this votação
        let govVoto: string | null = null;
        for (const voto of votos) {
          if (govLeaderIds.has(String(voto.CodigoParlamentar))) {
            const norm = normalizeVoto(voto.Voto);
            if (norm === "sim" || norm === "não") {
              govVoto = norm;
              break;
            }
          }
        }

        if (govVoto) votacoesWithGovOrient++;

        for (const voto of votos) {
          const senId = Number(voto.CodigoParlamentar);
          if (!senId) continue;

          if (!senatorScores[senId]) {
            senatorScores[senId] = {
              aligned: 0,
              relevant: 0,
              nome: voto.NomeParlamentar || "N/A",
              partido: voto.SiglaPartido || "",
              uf: voto.SiglaUF || "",
              foto: voto.Foto || "",
            };
          }

          votoBatch.push({
            senador_id: senId,
            codigo_sessao_votacao: String(codigo),
            voto: voto.Voto || "",
            ano: year,
          });

          const depNorm = normalizeVoto(voto.Voto);
          if (!depNorm || depNorm === "abstencao" || depNorm === "ausente") continue;

          if (govVoto) {
            senatorScores[senId].relevant++;
            if (depNorm === govVoto) senatorScores[senId].aligned++;
          }
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

      // Upsert votos
      for (let j = 0; j < votoBatch.length; j += 500) {
        const slice = votoBatch.slice(j, j + 500);
        const { error: votoErr } = await supabase
          .from("votos_senadores")
          .upsert(slice, { onConflict: "senador_id,codigo_sessao_votacao" });
        if (votoErr) console.error(`[sync-senado] Voto upsert error: ${votoErr.message}`);
        else votosStored += slice.length;
      }

      if (i % 50 === 0 && i > 0)
        console.log(`[sync-senado] Processed ${i}/${votacoes.length} votações`);
    }

    console.log(`[sync-senado] ${votacoesStored} votações, ${votosStored} votes stored`);
    console.log(`[sync-senado] ${votacoesWithGovOrient} votações with gov orientation`);

    // ── STEP 4: Classify and upsert senator analyses ──
    const records: any[] = [];
    for (const [senIdStr, data] of Object.entries(senatorScores)) {
      const score = data.relevant > 0 ? (data.aligned / data.relevant) * 100 : 0;
      let classificacao = "Centro";
      if (data.relevant === 0) classificacao = "Sem Dados";
      else if (score >= 50) classificacao = "Governo";
      else if (score <= 30) classificacao = "Oposição";

      records.push({
        senador_id: Number(senIdStr),
        senador_nome: data.nome,
        senador_partido: data.partido || null,
        senador_uf: data.uf || null,
        senador_foto: data.foto || null,
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
      if (upsertError) console.error(`[sync-senado] Upsert error: ${upsertError.message}`);
      else upsertCount += chunk.length;
    }

    console.log(
      `[sync-senado] Done: ${upsertCount} senators, ${votacoesStored} votações, ${votosStored} votes`
    );

    return jsonResponse({
      analyzed: upsertCount,
      votacoes_total: votacoes.length,
      votacoes_with_gov: votacoesWithGovOrient,
      votacoes_stored: votacoesStored,
      votos_stored: votosStored,
      year,
    });
  } catch (error) {
    console.error("[sync-senado] Fatal error:", error.message, error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
});
