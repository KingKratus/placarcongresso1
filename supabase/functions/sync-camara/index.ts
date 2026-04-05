import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BULK_BASE = "https://dadosabertos.camara.leg.br/arquivos";
const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

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
  if (v.includes("obstrução") || v.includes("obstrucao")) return "obstrucao";
  if (v.includes("ausente") || v.includes("ausência")) return "ausente";
  return v;
}

async function safeFetchJson(url: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchVotosForVotacao(votacaoId: string): Promise<any[]> {
  const json = await safeFetchJson(`${API_BASE}/votacoes/${votacaoId}/votos`);
  return json?.dados || [];
}

function parseProposicaoObjeto(obj: string | null | undefined): { tipo: string | null; numero: string | null; ano: number | null } {
  if (!obj) return { tipo: null, numero: null, ano: null };
  const match = obj.match(/^(\w+)\s+(\d+)\/(\d{4})$/);
  if (match) return { tipo: match[1], numero: match[2], ano: Number(match[3]) };
  const match2 = obj.match(/^(\w+)\s+(\d+)$/);
  if (match2) return { tipo: match2[1], numero: match2[2], ano: null };
  return { tipo: null, numero: null, ano: null };
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
    // ── Authentication ──
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");
    
    // Accept: service_role key, anon key via Bearer or apikey header
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === supabaseServiceKey || token === supabaseAnonKey || apikeyHeader === supabaseAnonKey;
    
    if (!authHeader?.startsWith("Bearer ") && !apikeyHeader) {
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
        .eq("casa", "camara")
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

    // ── Input validation ──
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
      id: runId, user_id: userId, casa: "camara", ano: year, status: "running",
    });

    console.log(`[sync-camara] Starting sync for year ${year}, run ${runId}`);
    await logEvent("init", `Iniciando sincronização da Câmara para ${year}`);

    // ── STEP 1: Fetch orientações ──
    await logEvent("orientacoes", "Baixando orientações de bancada...");
    const orientUrl = `${BULK_BASE}/votacoesOrientacoes/json/votacoesOrientacoes-${year}.json`;
    const orientRes = await fetch(orientUrl);
    if (!orientRes.ok) {
      await logEvent("error", `Arquivo de orientações para ${year} não disponível`);
      await finishRun("error", null, `Orientações para ${year} não disponíveis`);
      return jsonResponse({ error: `Não foi possível baixar orientações para ${year}`, run_id: runId }, 400);
    }
    const orientJson = await orientRes.json();
    const allOrientacoes: any[] = orientJson.dados || [];
    await logEvent("orientacoes", `${allOrientacoes.length} orientações carregadas`);

    // Identify gov-oriented votações
    const govOrientByVotacao: Record<string, string> = {};
    const govSiglas = ["governo", "gov.", "líder do governo", "lidgov"];

    for (const o of allOrientacoes) {
      const sigla = (o.siglaBancada || "").trim().toLowerCase();
      if (govSiglas.includes(sigla)) {
        const orient = (o.orientacao || "").trim();
        if (orient && orient.toLowerCase() !== "liberado") {
          govOrientByVotacao[String(o.idVotacao)] = orient;
        }
      }
    }

    // Store orientações
    await logEvent("orientacoes", "Salvando orientações no banco...");
    const orientRecords = allOrientacoes.map((o: any) => ({
      id_votacao: String(o.idVotacao),
      sigla_orgao_politico: o.siglaBancada || "",
      orientacao_voto: o.orientacao || "",
    }));
    for (let i = 0; i < orientRecords.length; i += 500) {
      await supabase.from("orientacoes").upsert(
        orientRecords.slice(i, i + 500),
        { onConflict: "id_votacao,sigla_orgao_politico" }
      );
    }

    // ── STEP 2: Fetch bulk votações with improved metadata parsing ──
    await logEvent("votacoes", "Baixando metadados de votações...");
    const votacoesUrl = `${BULK_BASE}/votacoes/json/votacoes-${year}.json`;
    const votacoesRes = await fetch(votacoesUrl);
    let allBulkVotacoes: any[] = [];
    if (votacoesRes.ok) {
      const votacoesJson = await votacoesRes.json();
      allBulkVotacoes = votacoesJson.dados || [];
      await logEvent("votacoes", `${allBulkVotacoes.length} votações carregadas do arquivo`);

      const bulkRecords: any[] = [];
      for (const v of allBulkVotacoes) {
        const vid = String(v.id);
        let prop = parseProposicaoObjeto(v.proposicaoObjeto);

        // Fallback: try proposicoesAfetadas array
        if (!prop.tipo && v.proposicoesAfetadas && Array.isArray(v.proposicoesAfetadas) && v.proposicoesAfetadas.length > 0) {
          const pa = v.proposicoesAfetadas[0];
          prop = {
            tipo: pa.siglaTipo || pa.tipo || null,
            numero: pa.numero ? String(pa.numero) : null,
            ano: pa.ano ? Number(pa.ano) : null,
          };
        }

        bulkRecords.push({
          id_votacao: vid,
          data: v.dataHoraRegistro || v.data || null,
          descricao: v.descricao || v.descUltimaAberturaVotacao || null,
          ano: year,
          sigla_orgao: v.siglaOrgao || null,
          proposicao_tipo: prop.tipo,
          proposicao_numero: prop.numero,
          proposicao_ementa: v.ementa || v.proposicoesAfetadas?.[0]?.ementa || null,
          proposicao_ano: prop.ano,
        });
      }

      for (let i = 0; i < bulkRecords.length; i += 500) {
        const { error: bErr } = await supabase
          .from("votacoes")
          .upsert(bulkRecords.slice(i, i + 500), { onConflict: "id_votacao" });
        if (bErr) console.error(`[sync-camara] Bulk votação upsert error: ${bErr.message}`);
      }
      await logEvent("votacoes", `${bulkRecords.length} registros de votação salvos`);
    } else {
      await logEvent("votacoes", "Arquivo bulk não disponível, usando API");
    }

    // ── STEP 3: Fetch metadata via API for missing votações ──
    const govVotacaoIds = Object.keys(govOrientByVotacao);
    const bulkVotacaoIdSet = new Set(allBulkVotacoes.map((v: any) => String(v.id)));
    const needApiMeta = govVotacaoIds.filter((id) => !bulkVotacaoIdSet.has(id));

    if (needApiMeta.length > 0) {
      await logEvent("metadata", `Buscando metadados via API para ${needApiMeta.length} votações`);
      const META_BATCH = 10;
      for (let i = 0; i < needApiMeta.length; i += META_BATCH) {
        const batch = needApiMeta.slice(i, i + META_BATCH);
        const metaResults = await Promise.all(batch.map(async (vid) => {
          const json = await safeFetchJson(`${API_BASE}/votacoes/${vid}`);
          return json?.dados || null;
        }));

        const records: any[] = [];
        for (let j = 0; j < batch.length; j++) {
          const meta = metaResults[j];
          const vid = batch[j];
          if (meta) {
            const proposicoes = meta.proposicoesAfetadas || [];
            const prop = proposicoes.length > 0 ? proposicoes[0] : null;
            records.push({
              id_votacao: vid,
              data: meta.dataHoraRegistro || meta.data || null,
              descricao: meta.descricao || null,
              ano: year,
              sigla_orgao: meta.siglaOrgao || null,
              proposicao_tipo: prop?.siglaTipo || null,
              proposicao_numero: prop?.numero ? String(prop.numero) : null,
              proposicao_ementa: prop?.ementa || null,
              proposicao_ano: prop?.ano ? Number(prop.ano) : null,
            });
          } else {
            records.push({ id_votacao: vid, ano: year });
          }
        }

        if (records.length > 0) {
          await supabase.from("votacoes").upsert(records, { onConflict: "id_votacao" });
        }
      }
    }

    await logEvent("votos", `${govVotacaoIds.length} votações com orientação do governo. Buscando votos individuais...`);

    // ── STEP 4: Fetch individual votes for gov-oriented votações ──
    const deputyScores: Record<number, {
      aligned: number; relevant: number;
      nome: string; partido: string; uf: string; foto: string;
    }> = {};

    let votosStored = 0;
    const VOTE_BATCH = 15;

    for (let b = 0; b < govVotacaoIds.length; b += VOTE_BATCH) {
      const batch = govVotacaoIds.slice(b, b + VOTE_BATCH);
      const results = await Promise.all(batch.map(fetchVotosForVotacao));

      const votoBatch: any[] = [];

      for (let idx = 0; idx < batch.length; idx++) {
        const votacaoId = batch[idx];
        const govOrient = govOrientByVotacao[votacaoId];
        const votos = results[idx];

        for (const voto of votos) {
          const depId = voto.deputado_?.id;
          if (!depId) continue;

          if (!deputyScores[depId]) {
            deputyScores[depId] = {
              aligned: 0, relevant: 0,
              nome: voto.deputado_?.nome || "N/A",
              partido: voto.deputado_?.siglaPartido || "",
              uf: voto.deputado_?.siglaUf || "",
              foto: voto.deputado_?.urlFoto || "",
            };
          }

          const depVoto = normalizeVoto(voto.tipoVoto);

          votoBatch.push({
            deputado_id: depId,
            id_votacao: votacaoId,
            voto: voto.tipoVoto || "",
            ano: year,
          });

          if (depVoto === "" || depVoto === "presidente") continue;

          const govNorm = normalizeVoto(govOrient);
          deputyScores[depId].relevant++;
          if (depVoto === govNorm) deputyScores[depId].aligned++;
        }
      }

      for (let j = 0; j < votoBatch.length; j += 500) {
        const slice = votoBatch.slice(j, j + 500);
        const { error: votoErr } = await supabase
          .from("votos_deputados")
          .upsert(slice, { onConflict: "deputado_id,id_votacao" });
        if (votoErr) console.error(`[sync-camara] Voto upsert error: ${votoErr.message}`);
        else votosStored += slice.length;
      }

      if (b % 60 === 0 && b > 0) {
        const pct = Math.round((b / govVotacaoIds.length) * 100);
        await logEvent("votos", `${pct}% — Processadas ${b}/${govVotacaoIds.length} votações, ${votosStored} votos salvos`);
      }
    }

    await logEvent("votos", `${votosStored} votos individuais salvos`);

    // ── STEP 4b: Fetch votes for NON-gov votações (for ProjetosTab) ──
    const allBulkIds = allBulkVotacoes.map((v: any) => String(v.id));
    const govIdSet = new Set(govVotacaoIds);
    const nonGovIds = allBulkIds.filter((id) => !govIdSet.has(id));
    const NON_GOV_LIMIT = 200; // increased for better coverage
    const nonGovBatch = nonGovIds.slice(0, NON_GOV_LIMIT);

    if (nonGovBatch.length > 0) {
      await logEvent("votos-extra", `Buscando votos de ${nonGovBatch.length} votações adicionais (sem orientação gov)...`);
      let extraVotos = 0;
      for (let b = 0; b < nonGovBatch.length; b += VOTE_BATCH) {
        const batch = nonGovBatch.slice(b, b + VOTE_BATCH);
        const results = await Promise.all(batch.map(fetchVotosForVotacao));
        const votoBatch: any[] = [];

        for (let idx = 0; idx < batch.length; idx++) {
          const votacaoId = batch[idx];
          const votos = results[idx];
          for (const voto of votos) {
            const depId = voto.deputado_?.id;
            if (!depId) continue;
            votoBatch.push({
              deputado_id: depId,
              id_votacao: votacaoId,
              voto: voto.tipoVoto || "",
              ano: year,
            });
            // Also populate deputyScores metadata for "Sem Dados" deputies
            if (!deputyScores[depId]) {
              deputyScores[depId] = {
                aligned: 0, relevant: 0,
                nome: voto.deputado_?.nome || "N/A",
                partido: voto.deputado_?.siglaPartido || "",
                uf: voto.deputado_?.siglaUf || "",
                foto: voto.deputado_?.urlFoto || "",
              };
            }
          }
        }

        for (let j = 0; j < votoBatch.length; j += 500) {
          const slice = votoBatch.slice(j, j + 500);
          const { error: votoErr } = await supabase
            .from("votos_deputados")
            .upsert(slice, { onConflict: "deputado_id,id_votacao" });
          if (!votoErr) extraVotos += slice.length;
        }
      }
      await logEvent("votos-extra", `${extraVotos} votos adicionais salvos`);
      votosStored += extraVotos;
    }

    // ── STEP 5: Fetch ALL current deputies list to catch zero-vote ones ──
    await logEvent("deputados-lista", "Buscando lista completa de deputados da legislatura atual...");
    const depListUrl = `${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600&idLegislatura=57`;
    const depListJson = await safeFetchJson(depListUrl);
    const allDeputados: any[] = depListJson?.dados || [];
    await logEvent("deputados-lista", `${allDeputados.length} deputados na legislatura atual`);

    // Add any missing deputies as "Sem Dados"
    for (const dep of allDeputados) {
      const depId = dep.id;
      if (!depId || deputyScores[depId]) continue;
      deputyScores[depId] = {
        aligned: 0, relevant: 0,
        nome: dep.nome || "N/A",
        partido: dep.siglaPartido || "",
        uf: dep.siglaUf || "",
        foto: dep.urlFoto || "",
      };
    }

    // ── STEP 6: Classify and upsert deputy analyses ──
    await logEvent("analises", "Calculando classificações dos deputados...");
    const records: any[] = [];
    for (const [depIdStr, data] of Object.entries(deputyScores)) {
      const score = data.relevant > 0 ? (data.aligned / data.relevant) * 100 : 0;
      let classificacao = "Centro";
      if (data.relevant === 0) classificacao = "Sem Dados";
      else if (score >= 70) classificacao = "Governo";
      else if (score <= 35) classificacao = "Oposição";

      records.push({
        deputado_id: Number(depIdStr),
        deputado_nome: data.nome,
        deputado_partido: data.partido || null,
        deputado_uf: data.uf || null,
        deputado_foto: data.foto || null,
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
        .from("analises_deputados")
        .upsert(chunk, { onConflict: "deputado_id,ano" });
      if (upsertError) console.error(`[sync-camara] Upsert error: ${upsertError.message}`);
      else upsertCount += chunk.length;
    }

    const semDadosCount = records.filter((r) => r.classificacao === "Sem Dados").length;

    const summary = {
      analyzed: upsertCount,
      sem_dados: semDadosCount,
      votacoes_total: allBulkVotacoes.length,
      votacoes_with_gov: govVotacaoIds.length,
      votos_stored: votosStored,
      year,
    };

    await logEvent("concluido", `✅ Sincronização concluída: ${upsertCount} deputados (${semDadosCount} sem dados), ${govVotacaoIds.length} votações gov, ${votosStored} votos`);

    if (userId) {
      await supabase.from("sync_logs").insert({ user_id: userId, casa: "camara" });
    }

    await finishRun("completed", summary);

    console.log(`[sync-camara] Done: ${upsertCount} deputies, ${govVotacaoIds.length} gov votações, ${votosStored} votes`);

    return jsonResponse({ ...summary, run_id: runId });
  } catch (error) {
    console.error("[sync-camara] Fatal error:", error.message, error.stack);
    await logEvent("error", `❌ Erro fatal: ${error.message}`);
    await finishRun("error", null, error.message);
    return jsonResponse({ error: "Erro interno do servidor.", run_id: runId }, 500);
  }
});
