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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) return dateStr;
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}`;
  return null;
}

function normalizeName(name: string): string {
  return name.trim().replace(/^(Astr\.\s*|Prof\.\s*|Dr\.\s*|Dra\.\s*|Sen\.\s*|Dep\.\s*)/i, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let runId: string | null = null;
  let userId: string | null = null;

  async function logEvent(step: string, message: string) {
    if (!runId) return;
    try {
      await supabase.from("sync_run_events").insert({ run_id: runId, step, message });
    } catch {}
  }

  async function finishRun(status: string, summary?: any, error?: string) {
    if (!runId) return;
    try {
      await supabase.from("sync_runs").update({
        status, finished_at: new Date().toISOString(),
        summary: summary || null, error: error || null,
      }).eq("id", runId);
    } catch {}
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === supabaseServiceKey || token === supabaseAnonKey 
      || apikeyHeader === supabaseAnonKey || apikeyHeader === supabaseServiceKey;
    
    if (!authHeader && !apikeyHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const bodyText = await req.text();

    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      userId = userData.user.id;
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: recentSyncs } = await supabase
        .from("sync_logs")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("casa", "senado")
        .gte("created_at", tenMinAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentSyncs && recentSyncs.length > 0) {
        const lastSync = new Date(recentSyncs[0].created_at);
        const nextAvailable = new Date(lastSync.getTime() + 10 * 60 * 1000);
        const remainingSec = Math.ceil((nextAvailable.getTime() - Date.now()) / 1000);
        return jsonResponse({
          error: `Aguarde ${Math.ceil(remainingSec / 60)} minuto(s) para sincronizar novamente.`,
          next_available: nextAvailable.toISOString(),
          remaining_seconds: remainingSec,
        }, 429);
      }
    }

    let year = new Date().getFullYear();
    try {
      if (bodyText) {
        const body = JSON.parse(bodyText);
        if (body?.ano !== undefined) {
          const inputYear = Number(body.ano);
          if (!Number.isInteger(inputYear) || inputYear < 2000 || inputYear > 2030) {
            return jsonResponse({ error: "Ano inválido. Deve ser entre 2000 e 2030." }, 400);
          }
          year = inputYear;
        }
        if (body?.run_id) runId = body.run_id;
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        return jsonResponse({ error: "JSON inválido no body." }, 400);
      }
    }

    if (!runId) runId = crypto.randomUUID();
    await supabase.from("sync_runs").insert({
      id: runId, user_id: userId, casa: "senado", ano: year, status: "running",
    });

    console.log(`[sync-senado] Starting sync for year ${year}, run ${runId}`);
    await logEvent("init", `Iniciando sincronização do Senado para ${year}`);

    await logEvent("votacoes", "Buscando votações com orientações...");
    const votacoes = await fetchVotacoesWithOrientacoes(year);
    await logEvent("votacoes", `${votacoes.length} votações encontradas`);

    // Build senator name → ID map
    await logEvent("senadores", "Carregando lista de senadores...");
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
      if (nomeCompleto) normalizedNameToId[normalizeName(nomeCompleto)] = { ...entry, original: nomeCompleto };
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
    await logEvent("senadores", `${senadorList.length} senadores mapeados`);

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

    // Process votações
    const senatorScores: Record<string, {
      aligned: number; total: number;
      nome: string; partido: string; uf: string;
    }> = {};

    let votacoesStored = 0;
    let votacoesWithGovOrient = 0;
    let consensusSkipped = 0;
    let votosStored = 0;
    const unresolvedNames = new Set<string>();
    // Track all senators seen in votes (for "Sem Dados")
    const seenSenators: Record<string, { nome: string; partido: string; uf: string }> = {};

    await logEvent("processamento", "Processando votações e votos...");

    for (let i = 0; i < votacoes.length; i += 10) {
      const batch = votacoes.slice(i, i + 10);
      const votacaoRecords: any[] = [];
      const votoBatch: any[] = [];

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

        // Store individual votes for ALL votações
        const parlamentares = votacao.votosParlamentar || [];
        for (const voto of parlamentares) {
          const nome = (voto.nomeParlamentar || "").trim();
          const mapping = resolveId(nome);
          if (!mapping) {
            unresolvedNames.add(nome);
            continue;
          }
          votoBatch.push({
            senador_id: mapping.id,
            codigo_sessao_votacao: String(codigo),
            voto: voto.voto || "",
            ano: year,
          });
          // Track for Sem Dados
          const senKey = `${mapping.id}`;
          if (!seenSenators[senKey]) {
            seenSenators[senKey] = { nome, partido: voto.partido || "", uf: voto.uf || "" };
          }
        }

        // Score calculation only for gov-oriented votações
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
        if (opoOrient && govOrient === opoOrient) { consensusSkipped++; continue; }
        votacoesWithGovOrient++;

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
          if (depNorm === govOrient) senatorScores[senKey].aligned++;
        }
      }

      if (votacaoRecords.length > 0) {
        const { error: vErr } = await supabase
          .from("votacoes_senado")
          .upsert(votacaoRecords, { onConflict: "codigo_sessao_votacao" });
        if (vErr) console.error(`[sync-senado] Votação upsert error: ${vErr.message}`);
        else votacoesStored += votacaoRecords.length;
      }

      for (let j = 0; j < votoBatch.length; j += 500) {
        const slice = votoBatch.slice(j, j + 500);
        const { error: votoErr } = await supabase
          .from("votos_senadores")
          .upsert(slice, { onConflict: "senador_id,codigo_sessao_votacao" });
        if (votoErr) console.error(`[sync-senado] Voto upsert error: ${votoErr.message}`);
        else votosStored += slice.length;
      }

      if (i % 50 === 0 && i > 0) {
        const pct = Math.round((i / votacoes.length) * 100);
        await logEvent("processamento", `${pct}% — Processadas ${i}/${votacoes.length} votações, ${votosStored} votos salvos`);
      }
    }

    await logEvent("votos", `${votacoesStored} votações, ${votosStored} votos salvos`);

    // Classify senators
    await logEvent("analises", "Calculando classificações dos senadores...");
    const records: any[] = [];
    const analyzedIds = new Set<number>();

    for (const [_senKey, data] of Object.entries(senatorScores)) {
      const mapping = resolveId(data.nome);
      if (!mapping) { unresolvedNames.add(data.nome); continue; }
      analyzedIds.add(mapping.id);

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

    // Add "Sem Dados" for senators who voted but had no gov-oriented votações
    for (const [senIdStr, data] of Object.entries(seenSenators)) {
      const senId = Number(senIdStr);
      if (analyzedIds.has(senId)) continue;
      const mapping = resolveId(data.nome);
      if (!mapping) continue;
      analyzedIds.add(mapping.id);

      records.push({
        senador_id: mapping.id,
        senador_nome: data.nome,
        senador_partido: data.partido || null,
        senador_uf: data.uf || null,
        senador_foto: mapping.foto || null,
        ano: year,
        score: 0,
        total_votos: 0,
        votos_alinhados: 0,
        classificacao: "Sem Dados",
      });
    }

    // Add "Sem Dados" for ALL senators from the official list who are still missing
    for (const sen of senadorList) {
      const ident = sen.IdentificacaoParlamentar;
      if (!ident) continue;
      const id = Number(ident.CodigoParlamentar);
      if (analyzedIds.has(id)) continue;
      analyzedIds.add(id);

      records.push({
        senador_id: id,
        senador_nome: (ident.NomeParlamentar || "").trim(),
        senador_partido: ident.SiglaPartidoParlamentar || null,
        senador_uf: ident.UfParlamentar || null,
        senador_foto: ident.UrlFotoParlamentar || null,
        ano: year,
        score: 0,
        total_votos: 0,
        votos_alinhados: 0,
        classificacao: "Sem Dados",
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

    const semDadosCount = records.filter((r) => r.classificacao === "Sem Dados").length;

    const summary = {
      analyzed: upsertCount,
      sem_dados: semDadosCount,
      votacoes_total: votacoes.length,
      votacoes_with_gov: votacoesWithGovOrient,
      votacoes_stored: votacoesStored,
      votos_stored: votosStored,
      unresolved_names: [...unresolvedNames],
      year,
    };

    await logEvent("concluido", `✅ Sincronização concluída: ${upsertCount} senadores (${semDadosCount} sem dados), ${votacoesStored} votações, ${votosStored} votos`);

    if (userId) {
      await supabase.from("sync_logs").insert({ user_id: userId, casa: "senado" });
    }

    await finishRun("completed", summary);

    console.log(`[sync-senado] Done: ${upsertCount} senators, ${votacoesStored} votações, ${votosStored} votes`);

    return jsonResponse({ ...summary, run_id: runId });
  } catch (error) {
    console.error("[sync-senado] Fatal error:", error.message, error.stack);
    await logEvent("error", `❌ Erro fatal: ${error.message}`);
    await finishRun("error", null, error.message);
    return jsonResponse({ error: "Erro interno do servidor.", run_id: runId }, 500);
  }
});
