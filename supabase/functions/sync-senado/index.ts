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

/** Parse BR date format "DD/MM/YYYY HH:MM:SS" to ISO string */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) return dateStr;
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}`;
  }
  return null;
}

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/^(Astr\.\s*|Prof\.\s*|Dr\.\s*|Dra\.\s*|Sen\.\s*|Dep\.\s*)/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const NAME_ALIASES: Record<string, string> = {
  "Astr. Marcos Pontes": "Astronauta Marcos Pontes",
  "Rogério Marinho": "Rogerio Marinho",
  "Prof. Dorinha Seabra": "Professora Dorinha Seabra Rezende",
  "Ivete da Silveira ": "Ivete da Silveira",
  "Ivete da Silveira": "Ivete da Silveira Caldas",
};

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Authentication: require a valid JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Input validation ──
    let year = new Date().getFullYear();
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        if (body?.ano !== undefined) {
          const inputYear = Number(body.ano);
          if (!Number.isInteger(inputYear) || inputYear < 2000 || inputYear > 2030) {
            return jsonResponse({ error: "Ano inválido. Deve ser entre 2000 e 2030." }, 400);
          }
          year = inputYear;
        }
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        return jsonResponse({ error: "JSON inválido no body." }, 400);
      }
    }

    console.log(`[sync-senado] Starting sync for year ${year}`);

    // ── STEP 1: Fetch all votações with orientações de bancada ──
    const votacoes = await fetchVotacoesWithOrientacoes(year);
    console.log(`[sync-senado] ${votacoes.length} votações fetched`);

    // ── STEP 2: Build senator name → ID map (fuzzy matching) ──
    const senadoresJson = await safeFetchJson(`${SENADO_API}/senador/lista/atual.json`);
    const senadorList = senadoresJson?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];

    const nameToId: Record<string, { id: number; foto: string }> = {};
    const normalizedNameToId: Record<string, { id: number; foto: string; original: string }> = {};

    for (const sen of senadorList) {
      const ident = sen.IdentificacaoParlamentar;
      if (!ident) continue;
      const nome = (ident.NomeParlamentar || "").trim();
      const nomeCompleto = (ident.NomeCompletoParlamentar || "").trim();
      const id = Number(ident.CodigoParlamentar);
      const foto = ident.UrlFotoParlamentar || "";
      const entry = { id, foto };

      nameToId[nome] = entry;
      if (nomeCompleto) nameToId[nomeCompleto] = entry;
      normalizedNameToId[normalizeName(nome)] = { ...entry, original: nome };
      if (nomeCompleto) {
        normalizedNameToId[normalizeName(nomeCompleto)] = { ...entry, original: nomeCompleto };
      }
    }

    const { data: existingAnalises } = await supabase
      .from("analises_senadores")
      .select("senador_id, senador_nome, senador_foto")
      .limit(1000);

    if (existingAnalises) {
      for (const a of existingAnalises) {
        if (!nameToId[a.senador_nome]) {
          nameToId[a.senador_nome] = { id: a.senador_id, foto: a.senador_foto || "" };
          normalizedNameToId[normalizeName(a.senador_nome)] = {
            id: a.senador_id, foto: a.senador_foto || "", original: a.senador_nome,
          };
        }
      }
    }

    function resolveId(voteName: string): { id: number; foto: string } | null {
      if (nameToId[voteName]) return nameToId[voteName];
      const alias = NAME_ALIASES[voteName] || NAME_ALIASES[voteName.trim()];
      if (alias && nameToId[alias]) return nameToId[alias];
      const norm = normalizeName(voteName);
      if (normalizedNameToId[norm]) return normalizedNameToId[norm];
      for (const [dbNorm, entry] of Object.entries(normalizedNameToId)) {
        if (dbNorm.includes(norm) || norm.includes(dbNorm)) {
          nameToId[voteName] = { id: entry.id, foto: entry.foto };
          return { id: entry.id, foto: entry.foto };
        }
      }
      return null;
    }

    // ── STEP 3: Process votações ──
    const senatorScores: Record<string, {
      aligned: number;
      total: number;
      nome: string;
      partido: string;
      uf: string;
    }> = {};

    let votacoesStored = 0;
    let votacoesWithGovOrient = 0;
    let consensusSkipped = 0;
    const unresolvedNames = new Set<string>();

    for (let i = 0; i < votacoes.length; i += 10) {
      const batch = votacoes.slice(i, i + 10);
      const votacaoRecords: any[] = [];

      for (const votacao of batch) {
        const codigo = votacao.codigoVotacaoSve;
        if (!codigo) continue;

        votacaoRecords.push({
          codigo_sessao_votacao: String(codigo),
          data: votacao.dataInicioVotacao ? parseDate(votacao.dataInicioVotacao) : null,
          descricao: votacao.descricaoVotacao || null,
          resultado: votacao.tipoSessao || null,
          ano: year,
          sigla_materia: votacao.siglaTipoMateria || null,
          numero_materia: votacao.numeroMateria ? String(votacao.numeroMateria) : null,
          materia_ano: votacao.anoMateria ? Number(votacao.anoMateria) : null,
          ementa: votacao.descricaoMateria || votacao.descricaoVotacao || null,
        });

        const orientacoes = votacao.orientacoesLideranca || [];
        let govOrient: string | null = null;
        let opoOrient: string | null = null;

        for (const orient of orientacoes) {
          const partido = (orient.partido || "").trim().toLowerCase();
          if (partido === "governo" || partido === "gov." || partido === "líder do governo") {
            const norm = normalizeVoto(orient.voto);
            if (norm === "sim" || norm === "não") govOrient = norm;
          }
          if (partido === "oposição" || partido === "oposicao" || partido === "minoria" ||
              partido.includes("oposição") || partido.includes("minoria")) {
            const norm = normalizeVoto(orient.voto);
            if (norm === "sim" || norm === "não") opoOrient = norm;
          }
        }

        if (!govOrient) continue;

        if (opoOrient && govOrient === opoOrient) {
          consensusSkipped++;
          continue;
        }
        votacoesWithGovOrient++;

        const parlamentares = votacao.votosParlamentar || [];
        for (const voto of parlamentares) {
          const nome = (voto.nomeParlamentar || "").trim();
          const partido = voto.partido || "";
          const uf = voto.uf || "";
          const votoStr = voto.voto || "";
          const senKey = `${nome}|${uf}`;

          if (!senatorScores[senKey]) {
            senatorScores[senKey] = { aligned: 0, total: 0, nome, partido, uf };
          }

          const depNorm = normalizeVoto(votoStr);
          senatorScores[senKey].total++;
          if (depNorm === govOrient) {
            senatorScores[senKey].aligned++;
          }
        }
      }

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

    console.log(`[sync-senado] ${votacoesStored} votações stored, ${votacoesWithGovOrient} effective, ${consensusSkipped} consensus skipped`);

    // ── STEP 4: Classify and upsert senator analyses ──
    const records: any[] = [];
    for (const [_senKey, data] of Object.entries(senatorScores)) {
      const mapping = resolveId(data.nome);
      if (!mapping) {
        unresolvedNames.add(data.nome);
        continue;
      }

      const score = data.total > 0 ? (data.aligned / data.total) * 100 : 0;
      let classificacao = "Centro";
      if (data.total === 0) classificacao = "Sem Dados";
      else if (score >= 70) classificacao = "Governo";
      else if (score <= 35) classificacao = "Oposição";

      records.push({
        senador_id: mapping.id,
        senador_nome: data.nome,
        senador_partido: data.partido || null,
        senador_uf: data.uf || null,
        senador_foto: mapping.foto || null,
        ano: year,
        score: Math.round(score * 100) / 100,
        total_votos: data.total,
        votos_alinhados: data.aligned,
        classificacao,
      });
    }

    if (unresolvedNames.size > 0) {
      console.log(`[sync-senado] Unresolved names (${unresolvedNames.size}): ${[...unresolvedNames].join(", ")}`);
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

    console.log(`[sync-senado] Done: ${upsertCount} senators, ${votacoesStored} votações, ${votacoesWithGovOrient} effective, ${consensusSkipped} consensus`);

    return jsonResponse({
      analyzed: upsertCount,
      votacoes_total: votacoes.length,
      votacoes_with_gov: votacoesWithGovOrient,
      votacoes_consensus_skipped: consensusSkipped,
      votacoes_stored: votacoesStored,
      unresolved_names: [...unresolvedNames],
      year,
    });
  } catch (error) {
    console.error("[sync-senado] Fatal error:", error.message, error.stack);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
