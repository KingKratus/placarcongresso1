import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Whitelist de tabelas seguras (nunca expõe profiles, api_keys, sync_*, user_roles, chat_conversations)
const SAFE_TABLES = new Set([
  "analises_deputados",
  "analises_senadores",
  "proposicoes_parlamentares",
  "deputy_performance_scores",
  "votacoes",
  "votacoes_senado",
  "votacao_temas",
  "orientacoes",
  "votos_deputados",
  "votos_senadores",
  "emendas_orcamentarias_transparencia",
]);

const SAFE_OPS = new Set(["eq", "gte", "lte", "ilike", "in"]);

interface SupabaseFilter {
  column: string;
  op: string;
  value: string | number | (string | number)[];
}

async function querySupabase(
  // deno-lint-ignore no-explicit-any
  sb: any,
  table: string,
  filters: SupabaseFilter[],
  select: string,
  orderBy: { column: string; ascending: boolean } | null,
  limit: number,
) {
  if (!SAFE_TABLES.has(table)) {
    return { error: `Tabela "${table}" não é permitida. Tabelas válidas: ${[...SAFE_TABLES].join(", ")}` };
  }
  const safeLimit = Math.min(Math.max(limit ?? 50, 1), 100);
  const safeSelect = (select || "*").slice(0, 500);

  let query = sb.from(table).select(safeSelect).limit(safeLimit);

  for (const f of filters || []) {
    if (!SAFE_OPS.has(f.op)) continue;
    // @ts-ignore - dinamico
    query = query[f.op](f.column, f.value);
  }
  if (orderBy?.column) {
    query = query.order(orderBy.column, { ascending: !!orderBy.ascending });
  }
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { rows: data, count: (data || []).length };
}

async function webSearch(query: string): Promise<{ results: Array<{ title: string; url: string; snippet: string }> } | { error: string }> {
  try {
    const r = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlacarCongressoBot/1.0)" },
    });
    if (!r.ok) return { error: `web_search HTTP ${r.status}` };
    const html = await r.text();
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = re.exec(html)) && results.length < 5) {
      const url = decodeURIComponent(m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]);
      results.push({
        title: m[2].replace(/<[^>]+>/g, "").trim(),
        url,
        snippet: m[3].replace(/<[^>]+>/g, "").trim().slice(0, 240),
      });
    }
    return { results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "web_search erro" };
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Busca na web por informações atualizadas. Use para notícias recentes, contexto político externo ou validação.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca em português" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_supabase",
      description: "Consulta segura ao banco do Placar do Congresso. Tabelas permitidas: analises_deputados, analises_senadores, proposicoes_parlamentares, deputy_performance_scores, votacoes, votacoes_senado, votacao_temas, orientacoes, votos_deputados, votos_senadores, emendas_orcamentarias_transparencia. Operadores: eq, gte, lte, ilike, in.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          select: { type: "string", description: "Colunas separadas por vírgula. Default: '*'" },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                op: { type: "string", enum: ["eq", "gte", "lte", "ilike", "in"] },
                value: {},
              },
              required: ["column", "op", "value"],
            },
          },
          order_by: {
            type: "object",
            properties: {
              column: { type: "string" },
              ascending: { type: "boolean" },
            },
          },
          limit: { type: "number", description: "Máx 100" },
        },
        required: ["table"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

    const systemPrompt = `Você é o **Placar do Congresso AI**, analista legislativo brasileiro.
Você tem 2 ferramentas:
1. **query_supabase** — consulta dados reais do banco (votações, parlamentares, proposições, scores de desempenho). Use para responder perguntas factuais.
2. **web_search** — busca na web por notícias e contexto externo. Use para informações recentes ou validação cruzada.
Também há dados de emendas parlamentares orçamentárias do Portal da Transparência, com valores empenhados, liquidados, pagos, tema/subtema por IA, execução, risco, autor, partido, UF e localidade.

REGRAS:
- Sempre responda em português brasileiro.
- Use as ferramentas SEMPRE que precisar de dados específicos — não invente.
- Combine dados internos (query_supabase) com contexto externo (web_search) quando relevante.
- Cite fontes da web com link quando usar web_search.
- Use markdown e emojis (📊 🏛️ 🗳️) para formatação clara.
- Limite consultas a 100 linhas; faça múltiplas se necessário.
- NUNCA tente acessar profiles, api_keys, user_roles, sync_runs ou chat_conversations.`;

    const conversationMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Loop multi-turn (até 5 iterações de tool-calling)
    for (let iter = 0; iter < 5; iter++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: conversationMessages,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit excedido. Aguarde um momento." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI error:", response.status, t);
        throw new Error(`AI gateway: ${response.status}`);
      }

      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("Resposta vazia");

      conversationMessages.push(msg);

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        // Resposta final
        return new Response(JSON.stringify({
          content: msg.content || "",
          iterations: iter + 1,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Executa cada tool call
      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }

        let result: any;
        if (fnName === "query_supabase") {
          result = await querySupabase(
            sb,
            args.table,
            args.filters || [],
            args.select || "*",
            args.order_by || null,
            args.limit || 50,
          );
        } else if (fnName === "web_search") {
          result = await webSearch(args.query || "");
        } else {
          result = { error: `Tool desconhecida: ${fnName}` };
        }

        console.log(`[ask-ai-tools] tool=${fnName} args=${JSON.stringify(args).slice(0, 200)}`);

        conversationMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
    }

    return new Response(JSON.stringify({
      content: "Limite de iterações de ferramentas atingido. Tente uma pergunta mais específica.",
      iterations: 5,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ask-ai-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
