import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract API key from Authorization header only
    const url = new URL(req.url);
    let apiKey: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      apiKey = authHeader.replace("Bearer ", "");
    }

    if (!apiKey) {
      return jsonResponse({ error: "API key required. Pass via Authorization: Bearer <key>" }, 401);
    }

    // Validate API key
    const { data: keyData, error: keyErr } = await supabase
      .from("api_keys")
      .select("id, user_id, is_active")
      .eq("api_key", apiKey)
      .single();

    if (keyErr || !keyData || !keyData.is_active) {
      return jsonResponse({ error: "Invalid or inactive API key" }, 403);
    }

    const casa = (url.searchParams.get("casa") || "camara").toLowerCase();
    const tipo = (url.searchParams.get("tipo") || "analises").toLowerCase();
    const ano = Number(url.searchParams.get("ano") || new Date().getFullYear());
    const limitRaw = Number(url.searchParams.get("limit") || 500);
    const offsetRaw = Number(url.searchParams.get("offset") || 0);
    const partido = url.searchParams.get("partido")?.toUpperCase().trim();
    const uf = url.searchParams.get("uf")?.toUpperCase().trim();
    const classificacao = url.searchParams.get("classificacao")?.trim();

    if (!["camara", "senado"].includes(casa)) {
      return jsonResponse({ error: "casa inválida. Use camara ou senado" }, 400);
    }
    if (!["analises", "votacoes", "votos"].includes(tipo)) {
      return jsonResponse({ error: "tipo inválido. Use analises, votacoes ou votos" }, 400);
    }
    if (!Number.isInteger(ano) || ano < 2023 || ano > 2030) {
      return jsonResponse({ error: "ano inválido. Use um ano entre 2023 e 2030" }, 400);
    }
    if (!Number.isFinite(limitRaw) || !Number.isFinite(offsetRaw) || limitRaw < 1 || offsetRaw < 0) {
      return jsonResponse({ error: "limit/offset inválidos" }, 400);
    }
    if (partido && !/^[A-Z0-9]{1,12}$/.test(partido)) return jsonResponse({ error: "partido inválido" }, 400);
    if (uf && !/^[A-Z]{2}$/.test(uf)) return jsonResponse({ error: "uf inválida" }, 400);
    if (classificacao && !/^[\p{L}\s]{3,30}$/u.test(classificacao)) return jsonResponse({ error: "classificacao inválida" }, 400);

    const limit = Math.min(Math.floor(limitRaw), 1000);
    const offset = Math.floor(offsetRaw);

    if (tipo === "analises") {
      if (casa === "camara") {
        let q = supabase
          .from("analises_deputados")
          .select("*", { count: "exact" })
          .eq("ano", ano);
        if (partido) q = q.eq("deputado_partido", partido);
        if (uf) q = q.eq("deputado_uf", uf);
        if (classificacao) q = q.eq("classificacao", classificacao);
        const { data, error, count } = await q
          .order("score", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, total: count, casa, ano, tipo });
      } else {
        let q = supabase
          .from("analises_senadores")
          .select("*", { count: "exact" })
          .eq("ano", ano);
        if (partido) q = q.eq("senador_partido", partido);
        if (uf) q = q.eq("senador_uf", uf);
        if (classificacao) q = q.eq("classificacao", classificacao);
        const { data, error, count } = await q
          .order("score", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, total: count, casa, ano, tipo });
      }
    }

    if (tipo === "votacoes") {
      if (casa === "camara") {
        const { data, error, count } = await supabase
          .from("votacoes")
          .select("*", { count: "exact" })
          .eq("ano", ano)
          .order("data", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, total: count, casa, ano, tipo });
      } else {
        const { data, error, count } = await supabase
          .from("votacoes_senado")
          .select("*", { count: "exact" })
          .eq("ano", ano)
          .order("data", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, total: count, casa, ano, tipo });
      }
    }

    if (tipo === "votos") {
      const votacaoId = url.searchParams.get("votacao_id");
      if (!votacaoId || votacaoId.length > 120 || !/^[A-Za-z0-9_./:-]+$/.test(votacaoId)) {
        return jsonResponse({ error: "votacao_id válido é obrigatório para tipo=votos" }, 400);
      }
      if (casa === "camara") {
        let q = supabase
          .from("votos_deputados")
          .select("*")
          .eq("id_votacao", votacaoId);
        if (partido || uf) {
          const { data: analises } = await supabase
            .from("analises_deputados")
            .select("deputado_id")
            .eq("ano", ano)
            .match({ ...(partido ? { deputado_partido: partido } : {}), ...(uf ? { deputado_uf: uf } : {}) });
          const ids = (analises || []).map((a) => a.deputado_id);
          if (ids.length === 0) return jsonResponse({ data: [], casa, tipo, votacao_id: votacaoId });
          q = q.in("deputado_id", ids.slice(0, 500));
        }
        const { data, error } = await q.limit(limit);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, casa, tipo, votacao_id: votacaoId });
      } else {
        let q = supabase
          .from("votos_senadores")
          .select("*")
          .eq("codigo_sessao_votacao", votacaoId);
        if (partido || uf) {
          const { data: analises } = await supabase
            .from("analises_senadores")
            .select("senador_id")
            .eq("ano", ano)
            .match({ ...(partido ? { senador_partido: partido } : {}), ...(uf ? { senador_uf: uf } : {}) });
          const ids = (analises || []).map((a) => a.senador_id);
          if (ids.length === 0) return jsonResponse({ data: [], casa, tipo, votacao_id: votacaoId });
          q = q.in("senador_id", ids.slice(0, 200));
        }
        const { data, error } = await q.limit(limit);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, casa, tipo, votacao_id: votacaoId });
      }
    }

    return jsonResponse({
      error: "tipo inválido. Use: analises, votacoes, votos",
      usage: {
        base: "/api-dados",
        params: {
          casa: "camara | senado",
          ano: "2023-2030",
          tipo: "analises | votacoes | votos",
          limit: "1-1000",
          offset: "pagination offset",
          partido: "optional for analises and votos",
          uf: "optional for analises and votos",
          classificacao: "optional for analises",
          votacao_id: "required when tipo=votos",
        },
      },
    }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[api-dados] Error:", msg);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
