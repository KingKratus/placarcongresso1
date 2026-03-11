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
    const res = await fetch(url);
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Authentication ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;

    // Buffer body before auth to avoid stream consumption issues
    const bodyText = await req.text();

    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const userId = userData.user.id;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: recentSyncs } = await adminClient
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

      await adminClient.from("sync_logs").insert({ user_id: userId, casa: "camara" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        return jsonResponse({ error: "JSON inválido no body." }, 400);
      }
    }

    console.log(`[sync-camara] Starting sync for year ${year}`);

    // ── STEP 1: Fetch orientações from bulk file ──
    const orientUrl = `${BULK_BASE}/votacoesOrientacoes/json/votacoesOrientacoes-${year}.json`;
    const orientRes = await fetch(orientUrl);
    if (!orientRes.ok) {
      return jsonResponse({ error: `Não foi possível baixar orientações para ${year}` }, 400);
    }
    const orientJson = await orientRes.json();
    const allOrientacoes: any[] = orientJson.dados || [];
    console.log(`[sync-camara] ${allOrientacoes.length} orientações loaded`);

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

    // ── STEP 2: Fetch bulk votações file for ALL metadata ──
    const votacoesUrl = `${BULK_BASE}/votacoes/json/votacoes-${year}.json`;
    console.log(`[sync-camara] Fetching bulk votações: ${votacoesUrl}`);
    const votacoesRes = await fetch(votacoesUrl);
    let allBulkVotacoes: any[] = [];
    if (votacoesRes.ok) {
      const votacoesJson = await votacoesRes.json();
      allBulkVotacoes = votacoesJson.dados || [];
      console.log(`[sync-camara] ${allBulkVotacoes.length} votações from bulk file`);

      // Store ALL votação metadata from bulk file
      const bulkRecords: any[] = [];
      for (const v of allBulkVotacoes) {
        const vid = String(v.id);
        const prop = parseProposicaoObjeto(v.proposicaoObjeto);
        bulkRecords.push({
          id_votacao: vid,
          data: v.dataHoraRegistro || v.data || null,
          descricao: v.descricao || v.descUltimaAberturaVotacao || null,
          ano: year,
          sigla_orgao: v.siglaOrgao || null,
          proposicao_tipo: prop.tipo,
          proposicao_numero: prop.numero,
          proposicao_ementa: v.ementa || null,
          proposicao_ano: prop.ano,
        });
      }

      for (let i = 0; i < bulkRecords.length; i += 500) {
        const { error: bErr } = await supabase
          .from("votacoes")
          .upsert(bulkRecords.slice(i, i + 500), { onConflict: "id_votacao" });
        if (bErr) console.error(`[sync-camara] Bulk votação upsert error: ${bErr.message}`);
      }
      console.log(`[sync-camara] ${bulkRecords.length} bulk votação records stored`);
    } else {
      console.log(`[sync-camara] Bulk votações file not available, falling back to API`);
    }

    // ── STEP 3: Fetch metadata via API for gov-oriented votações not in bulk ──
    const govVotacaoIds = Object.keys(govOrientByVotacao);
    const bulkVotacaoIdSet = new Set(allBulkVotacoes.map((v: any) => String(v.id)));
    const needApiMeta = govVotacaoIds.filter((id) => !bulkVotacaoIdSet.has(id));

    if (needApiMeta.length > 0) {
      console.log(`[sync-camara] Fetching API metadata for ${needApiMeta.length} votações not in bulk`);
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

    console.log(`[sync-camara] ${govVotacaoIds.length} votações with gov orientation`);

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

      if (b % 50 === 0 && b > 0) console.log(`[sync-camara] Processed ${b}/${govVotacaoIds.length} votações`);
    }

    console.log(`[sync-camara] ${votosStored} individual votes stored`);

    // ── STEP 5: Classify and upsert deputy analyses ──
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

    console.log(`[sync-camara] Done: ${upsertCount} deputies, ${govVotacaoIds.length} gov votações, ${allBulkVotacoes.length} total votações, ${votosStored} votes`);

    return jsonResponse({
      analyzed: upsertCount,
      votacoes_total: allBulkVotacoes.length,
      votacoes_with_gov: govVotacaoIds.length,
      votos_stored: votosStored,
      year,
    });
  } catch (error) {
    console.error("[sync-camara] Fatal error:", error.message, error.stack);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
