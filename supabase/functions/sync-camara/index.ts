import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BULK_BASE = "https://dadosabertos.camara.leg.br/arquivos";
const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const year = body.ano || new Date().getFullYear();

    console.log(`Starting sync for year ${year} using bulk data files`);

    // ── STEP 1: Fetch bulk orientações ──
    const orientUrl = `${BULK_BASE}/votacoesOrientacoes/json/votacoesOrientacoes-${year}.json`;
    console.log(`Fetching orientações: ${orientUrl}`);
    const orientRes = await fetch(orientUrl);
    if (!orientRes.ok) {
      return jsonResponse({ error: `Não foi possível baixar orientações para ${year} (${orientRes.status})` }, 400);
    }
    const orientJson = await orientRes.json();
    const allOrientacoes = orientJson.dados || [];
    console.log(`Loaded ${allOrientacoes.length} orientações`);

    // Extract government orientations per votação
    const govOrientByVotacao: Record<string, string> = {};
    const govSiglas = ["governo", "gov.", "líder do governo", "lidgov"];

    for (const o of allOrientacoes) {
      const sigla = (o.siglaBancada || "").trim().toLowerCase();
      if (govSiglas.includes(sigla)) {
        const orient = (o.orientacao || "").trim();
        if (orient && orient.toLowerCase() !== "liberado") {
          govOrientByVotacao[o.idVotacao] = orient;
        }
      }
    }

    const votacoesComGov = Object.keys(govOrientByVotacao);
    console.log(`Found ${votacoesComGov.length} votações with government orientation`);

    if (votacoesComGov.length === 0) {
      return jsonResponse({ analyzed: 0, year, message: "Nenhuma votação com orientação do governo encontrada" });
    }

    // Cache orientações in DB
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

    // ── STEP 2: Fetch bulk votos ──
    const votosUrl = `${BULK_BASE}/votacoesVotos/json/votacoesVotos-${year}.json`;
    console.log(`Fetching votos: ${votosUrl}`);
    const votosRes = await fetch(votosUrl);
    if (!votosRes.ok) {
      return jsonResponse({ error: `Não foi possível baixar votos para ${year} (${votosRes.status})` }, 400);
    }
    const votosJson = await votosRes.json();
    const allVotos = votosJson.dados || [];
    console.log(`Loaded ${allVotos.length} individual votes`);

    // ── STEP 3: Compute alignment + store individual votes ──
    const deputyScores: Record<number, {
      aligned: number;
      relevant: number;
      nome: string;
      partido: string;
      uf: string;
      foto: string;
    }> = {};

    // Collect individual vote records for detail pages
    const votoRecords: any[] = [];

    for (const voto of allVotos) {
      const votacaoId = String(voto.idVotacao);
      const govOrient = govOrientByVotacao[votacaoId];
      if (!govOrient) continue;

      const depIdRaw = voto.deputado_?.id;
      if (!depIdRaw) continue;
      const depId = Number(depIdRaw);

      if (!deputyScores[depId]) {
        deputyScores[depId] = {
          aligned: 0,
          relevant: 0,
          nome: voto.deputado_?.nome || "N/A",
          partido: voto.deputado_?.siglaPartido || "",
          uf: voto.deputado_?.siglaUf || "",
          foto: voto.deputado_?.urlFoto || "",
        };
      }

      const depVoto = normalizeVoto(voto.voto || voto.tipoVoto);

      // Store all votes (including abstentions) for detail page
      votoRecords.push({
        deputado_id: depId,
        id_votacao: votacaoId,
        voto: voto.voto || voto.tipoVoto || "",
        ano: year,
      });

      if (depVoto === "abstencao" || depVoto === "ausente" || depVoto === "obstrucao" || depVoto === "") {
        continue;
      }

      const govNorm = normalizeVoto(govOrient);
      deputyScores[depId].relevant++;
      if (depVoto === govNorm) {
        deputyScores[depId].aligned++;
      }
    }

    console.log(`Computed scores for ${Object.keys(deputyScores).length} deputies, ${votoRecords.length} individual votes`);

    // ── STEP 4: Classify and upsert deputy analyses ──
    const records: any[] = [];
    for (const [depIdStr, data] of Object.entries(deputyScores)) {
      const depId = Number(depIdStr);
      const score = data.relevant > 0 ? (data.aligned / data.relevant) * 100 : 0;
      let classificacao = "Centro";
      if (data.relevant === 0) classificacao = "Sem Dados";
      else if (score >= 70) classificacao = "Governo";
      else if (score <= 35) classificacao = "Oposição";

      records.push({
        deputado_id: depId,
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
      if (upsertError) {
        console.error(`Upsert error at batch ${i}: ${upsertError.message}`);
      } else {
        upsertCount += chunk.length;
      }
    }

    // ── STEP 5: Store individual votes for detail pages ──
    let votosStored = 0;
    for (let i = 0; i < votoRecords.length; i += 500) {
      const chunk = votoRecords.slice(i, i + 500);
      const { error: votoErr } = await supabase
        .from("votos_deputados")
        .upsert(chunk, { onConflict: "deputado_id,id_votacao" });
      if (votoErr) {
        console.error(`Voto upsert error at batch ${i}: ${votoErr.message}`);
      } else {
        votosStored += chunk.length;
      }
    }
    console.log(`Stored ${votosStored} individual vote records`);

    // ── STEP 6: Cache votação metadata with proposição details ──
    // Fetch votação details from API to get proposição info
    const votacaoMeta: Record<string, any> = {};
    for (const o of allOrientacoes) {
      const vid = String(o.idVotacao);
      if (!votacaoMeta[vid] && govOrientByVotacao[vid]) {
        votacaoMeta[vid] = {
          id_votacao: vid,
          data: o.dataHoraVotacao || null,
          descricao: o.proposicaoObjeto || o.votacao_proposicaoObjeto || null,
          ano: year,
          sigla_orgao: o.siglaOrgao || null,
          proposicao_tipo: o.proposicao_tipo || null,
          proposicao_numero: o.proposicao_numero || null,
          proposicao_ementa: o.proposicaoObjeto || o.votacao_proposicaoObjeto || null,
        };
      }
    }

    const votacaoRecords = Object.values(votacaoMeta);
    for (let i = 0; i < votacaoRecords.length; i += 500) {
      await supabase.from("votacoes").upsert(
        votacaoRecords.slice(i, i + 500),
        { onConflict: "id_votacao" }
      );
    }

    console.log(`Upserted ${upsertCount} deputy analyses, ${votacaoRecords.length} votações, ${votosStored} individual votes`);

    return jsonResponse({
      analyzed: upsertCount,
      votacoes_with_gov: votacoesComGov.length,
      total_votos_processed: allVotos.length,
      votos_stored: votosStored,
      year,
    });
  } catch (error) {
    console.error("Fatal error:", error.message, error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
});

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
