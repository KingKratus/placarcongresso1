import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Proposicao {
  tipo: string;
  numero: string;
  ano: number;
  ementa: string;
  url: string;
  data_apresentacao: string | null;
  status_tramitacao?: string | null;
  proposicao_id?: number;
}

const PESO_TIPO: Record<string, number> = {
  PEC: 1.0, PLP: 0.8, PL: 0.6, MPV: 0.7, PDL: 0.4, PRC: 0.4, REQ: 0.1,
};

function normalizeStatus(raw: string | null | undefined): string {
  if (!raw) return "Em tramitação";
  const s = raw.toLowerCase();
  if (s.includes("promulgad") || s.includes("transformad") || s.includes("sancionad")) return "Aprovada";
  if (s.includes("aprovad")) return "Aprovada";
  if (s.includes("arquivad")) return "Arquivada";
  if (s.includes("rejeit")) return "Rejeitada";
  if (s.includes("retirad")) return "Retirada";
  return "Em tramitação";
}

async function fetchCamaraProposicoes(deputadoId: number): Promise<(Proposicao & { tipo_autoria: string })[]> {
  const all: (Proposicao & { tipo_autoria: string })[] = [];
  const tipos = ["PL", "PLP", "PEC", "PRC", "PDL", "MPV", "REQ"];

  for (const tipo of tipos) {
    try {
      const url = `https://dadosabertos.camara.leg.br/api/v2/proposicoes?idDeputadoAutor=${deputadoId}&siglaTipo=${tipo}&ordem=DESC&ordenarPor=ano&itens=100`;
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      if (!resp.ok) continue;
      const json = await resp.json();
      const dados = json.dados || [];
      for (const p of dados) {
        // Fetch authors to detect autor vs coautor
        let tipo_autoria = "autor";
        try {
          const aResp = await fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${p.id}/autores`, { headers: { Accept: "application/json" } });
          if (aResp.ok) {
            const aJson = await aResp.json();
            const autores = aJson.dados || [];
            if (autores.length > 1) {
              const me = autores.find((au: any) => String(au.uri || "").endsWith(`/${deputadoId}`));
              if (me && me.proponente !== 1 && autores[0] && !String(autores[0].uri || "").endsWith(`/${deputadoId}`)) {
                tipo_autoria = "coautor";
              }
            }
          }
        } catch (_) { /* keep default */ }

        all.push({
          tipo: p.siglaTipo || tipo,
          numero: String(p.numero || ""),
          ano: p.ano || 0,
          ementa: p.ementa || "",
          url: p.urlInteiroTeor || `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
          data_apresentacao: p.dataApresentacao || null,
          proposicao_id: p.id,
          status_tramitacao: p.descricaoSituacao || null,
          tipo_autoria,
        });
      }
    } catch (e) {
      console.error(`Error fetching ${tipo} for deputy ${deputadoId}:`, e);
    }
  }
  return all;
}

async function fetchSenadoProposicoes(senadorId: number): Promise<Proposicao[]> {
  const all: Proposicao[] = [];
  try {
    const url = `https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?codigoParticipante=${senadorId}&v=7`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return all;
    const json = await resp.json();
    const materias = json?.PesquisaBasicaMateria?.Materias?.Materia || [];
    for (const m of (Array.isArray(materias) ? materias : [materias])) {
      const id = m?.IdentificacaoMateria;
      if (!id) continue;
      all.push({
        tipo: id.SiglaSubtipoMateria || id.SiglaTipoMateria || "?",
        numero: String(id.NumeroMateria || ""),
        ano: Number(id.AnoMateria || 0),
        ementa: m?.EmentaMateria || m?.Ementa || "",
        url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${id.CodigoMateria}`,
        data_apresentacao: m?.DataApresentacao || null,
      });
    }
  } catch (e) {
    console.error(`Error fetching proposicoes for senator ${senadorId}:`, e);
  }
  return all;
}

async function classifyThemes(proposicoes: Proposicao[]): Promise<Record<string, string>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || proposicoes.length === 0) return {};

  const temas: Record<string, string> = {};
  const batchSize = 30;

  for (let i = 0; i < proposicoes.length; i += batchSize) {
    const batch = proposicoes.slice(i, i + batchSize);
    const prompt = batch.map((p, idx) => `${idx + 1}. [${p.tipo} ${p.numero}/${p.ano}] ${p.ementa?.slice(0, 200) || "Sem ementa"}`).join("\n");

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Classifique cada proposição legislativa em UM tema. Temas possíveis: Econômico, Social, Segurança, Educação, Saúde, Meio Ambiente, Infraestrutura, Político-Institucional, Trabalhista, Tributário, Direitos Humanos, Cultura, Tecnologia, Agropecuária, Defesa, Outros.
Responda APENAS com JSON: {"1":"tema","2":"tema",...}`,
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!resp.ok) continue;
      const json = await resp.json();
      const content = json.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        for (const [idx, tema] of Object.entries(parsed)) {
          const realIdx = i + Number(idx) - 1;
          if (realIdx >= 0 && realIdx < proposicoes.length) {
            const key = `${proposicoes[realIdx].tipo}-${proposicoes[realIdx].numero}-${proposicoes[realIdx].ano}`;
            temas[key] = tema as string;
          }
        }
      }
    } catch (e) {
      console.error("Classification batch error:", e);
    }
  }
  return temas;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parlamentar_id, casa } = await req.json();
    if (!parlamentar_id || !casa) {
      return new Response(JSON.stringify({ error: "parlamentar_id and casa are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, serviceKey);

    // Check cache
    const { data: cached } = await sb
      .from("proposicoes_parlamentares")
      .select("*")
      .eq("parlamentar_id", parlamentar_id)
      .eq("casa", casa)
      .order("ano", { ascending: false });

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({ proposicoes: cached, source: "cache" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from API
    const proposicoes = casa === "camara"
      ? await fetchCamaraProposicoes(parlamentar_id)
      : await fetchSenadoProposicoes(parlamentar_id);

    if (proposicoes.length === 0) {
      return new Response(JSON.stringify({ proposicoes: [], source: "api" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Classify with AI
    const themes = await classifyThemes(proposicoes);

    // Save to cache
    const rows = proposicoes.map((p: any) => ({
      parlamentar_id,
      casa,
      tipo: p.tipo,
      numero: p.numero,
      ano: p.ano,
      ementa: p.ementa,
      tema: themes[`${p.tipo}-${p.numero}-${p.ano}`] || "Outros",
      url: p.url,
      data_apresentacao: p.data_apresentacao,
      status_tramitacao: normalizeStatus(p.status_tramitacao),
      peso_tipo: PESO_TIPO[p.tipo] ?? 0.3,
      tipo_autoria: p.tipo_autoria || "autor",
    }));

    // Upsert in batches
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      await sb.from("proposicoes_parlamentares").upsert(batch, {
        onConflict: "parlamentar_id,casa,tipo,numero,ano",
      });
    }

    return new Response(JSON.stringify({ proposicoes: rows, source: "api" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-proposicoes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
