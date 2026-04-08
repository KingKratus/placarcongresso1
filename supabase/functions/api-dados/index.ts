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

    // Parse query params
    const casa = url.searchParams.get("casa") || "camara";
    const ano = Number(url.searchParams.get("ano") || new Date().getFullYear());
    const tipo = url.searchParams.get("tipo") || "analises";
    const limit = Math.min(Number(url.searchParams.get("limit") || 500), 1000);
    const offset = Number(url.searchParams.get("offset") || 0);

    if (tipo === "analises") {
      if (casa === "camara") {
        const { data, error, count } = await supabase
          .from("analises_deputados")
          .select("*", { count: "exact" })
          .eq("ano", ano)
          .order("score", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, total: count, casa, ano, tipo });
      } else {
        const { data, error, count } = await supabase
          .from("analises_senadores")
          .select("*", { count: "exact" })
          .eq("ano", ano)
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
      if (!votacaoId) {
        return jsonResponse({ error: "votacao_id required for tipo=votos" }, 400);
      }
      if (casa === "camara") {
        const { data, error } = await supabase
          .from("votos_deputados")
          .select("*")
          .eq("id_votacao", votacaoId)
          .limit(limit);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, casa, tipo, votacao_id: votacaoId });
      } else {
        const { data, error } = await supabase
          .from("votos_senadores")
          .select("*")
          .eq("codigo_sessao_votacao", votacaoId)
          .limit(limit);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data, casa, tipo, votacao_id: votacaoId });
      }
    }

    return jsonResponse({
      error: "tipo inválido. Use: analises, votacoes, votos",
      usage: {
        base: "/api-dados",
        params: {
          apikey: "required",
          casa: "camara | senado",
          ano: "2023-2026",
          tipo: "analises | votacoes | votos",
          limit: "max 1000",
          offset: "pagination offset",
          votacao_id: "required when tipo=votos",
        },
      },
    }, 400);
  } catch (error) {
    console.error("[api-dados] Error:", error.message);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
