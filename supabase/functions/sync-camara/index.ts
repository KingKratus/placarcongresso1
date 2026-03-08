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

async function fetchVotacaoMetadata(votacaoId: string): Promise<any | null> {
  const json = await safeFetchJson(`${API_BASE}/votacoes/${votacaoId}`);
  return json?.dados || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth is handled by verify_jwt = false in config.toml
    // This function is intended for cron/internal/manual calls only
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Safe body parsing — cron may send empty or non-JSON body
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

    console.log(`[sync-camara] Starting sync for year ${year}`);

    // ── STEP 1: Fetch orientações from bulk file ──
    const orientUrl = `${BULK_BASE}/votacoesOrientacoes/json/votacoesOrientacoes-${year}.json`;
    const orientRes = await fetch(orientUrl);
    if (!orientRes.ok) {
      return jsonResponse({ error: `Não foi possível baixar orientações para ${year} (${orientRes.status})` }, 400);
    }
    const orientJson = await orientRes.json();
    const allOrientacoes: any[] = orientJson.dados || [];
    console.log(`[sync-camara] ${allOrientacoes.length} orientações loaded`);

    // Identify votações where government gave a non-"liberado" orientation
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

    // Store orientações in batches
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

    const votacaoIds = Object.keys(govOrientByVotacao);
    console.log(`[sync-camara] ${votacaoIds.length} votações with gov orientation`);

    // ── STEP 2: Fetch votação metadata from API (bulk file lacks this) ──
    const META_BATCH = 10;
    let metaFetched = 0;
    for (let i = 0; i < votacaoIds.length; i += META_BATCH) {
      const batch = votacaoIds.slice(i, i + META_BATCH);
      const metaResults = await Promise.all(batch.map(fetchVotacaoMetadata));

      const votacaoRecords: any[] = [];
      for (let j = 0; j < batch.length; j++) {
        const meta = metaResults[j];
        const vid = batch[j];
        if (meta) {
          // Extract proposição info from the API response
          const proposicoes = meta.proposicoesAfetadas || [];
          const prop = proposicoes.length > 0 ? proposicoes[0] : null;

          votacaoRecords.push({
            id_votacao: vid,
            data: meta.dataHoraRegistro || meta.data || null,
            descricao: meta.descricao || meta.descUltimaAberturaVotacao || null,
            ano: year,
            sigla_orgao: meta.siglaOrgao || null,
            proposicao_tipo: prop?.siglaTipo || null,
            proposicao_numero: prop?.numero ? String(prop.numero) : null,
            proposicao_ementa: prop?.ementa || null,
            proposicao_ano: prop?.ano ? Number(prop.ano) : null,
          });
        } else {
          // Fallback: store minimal record so we don't lose the votação
          votacaoRecords.push({
            id_votacao: vid,
            ano: year,
          });
        }
      }

      if (votacaoRecords.length > 0) {
        const { error: metaErr } = await supabase
          .from("votacoes")
          .upsert(votacaoRecords, { onConflict: "id_votacao" });
        if (metaErr) console.error(`[sync-camara] Votação meta upsert error: ${metaErr.message}`);
        else metaFetched += votacaoRecords.length;
      }

      if (i % 50 === 0 && i > 0) console.log(`[sync-camara] Fetched metadata for ${i}/${votacaoIds.length} votações`);
    }
    console.log(`[sync-camara] ${metaFetched} votação metadata records stored`);

    // ── STEP 3: Fetch individual votes per votação ──
    const deputyScores: Record<number, {
      aligned: number; relevant: number;
      nome: string; partido: string; uf: string; foto: string;
    }> = {};

    let votosStored = 0;
    const VOTE_BATCH = 15;

    for (let b = 0; b < votacaoIds.length; b += VOTE_BATCH) {
      const batch = votacaoIds.slice(b, b + VOTE_BATCH);
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

          if (depVoto === "abstencao" || depVoto === "ausente" || depVoto === "obstrucao" || depVoto === "") continue;

          const govNorm = normalizeVoto(govOrient);
          deputyScores[depId].relevant++;
          if (depVoto === govNorm) deputyScores[depId].aligned++;
        }
      }

      // Upsert votes
      for (let j = 0; j < votoBatch.length; j += 500) {
        const slice = votoBatch.slice(j, j + 500);
        const { error: votoErr } = await supabase
          .from("votos_deputados")
          .upsert(slice, { onConflict: "deputado_id,id_votacao" });
        if (votoErr) console.error(`[sync-camara] Voto upsert error: ${votoErr.message}`);
        else votosStored += slice.length;
      }

      if (b % 50 === 0 && b > 0) console.log(`[sync-camara] Processed ${b}/${votacaoIds.length} votações`);
    }

    console.log(`[sync-camara] ${votosStored} individual votes stored`);

    // ── STEP 4: Classify and upsert deputy analyses ──
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

    console.log(`[sync-camara] Done: ${upsertCount} deputies, ${metaFetched} votações, ${votosStored} votes`);

    return jsonResponse({
      analyzed: upsertCount,
      votacoes_with_gov: votacaoIds.length,
      votacoes_metadata: metaFetched,
      votos_stored: votosStored,
      year,
    });
  } catch (error) {
    console.error("[sync-camara] Fatal error:", error.message, error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
});
