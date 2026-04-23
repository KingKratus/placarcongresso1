import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Gera infográficos visuais usando a API do Google Gemini (AI Studio) DIRETAMENTE,
 * sem passar pelo Lovable AI Gateway. Requer secret GOOGLE_GEMINI_API_KEY.
 *
 * Body:
 *   {
 *     formato: "card" | "relatorio",
 *     dados: { titulo, subtitulo, foto?, metricas: [{label, valor, hint?}], destaques?: string[], rodape? }
 *   }
 * Retorna: { image: "data:image/png;base64,..." }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { formato = "card", dados } = await req.json();
    if (!dados || !dados.titulo) {
      return new Response(JSON.stringify({ error: "Campo 'dados.titulo' obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metricasStr = (dados.metricas || [])
      .map((m: any) => `- ${m.label}: ${m.valor}${m.hint ? ` (${m.hint})` : ""}`)
      .join("\n");
    const destaquesStr = (dados.destaques || []).map((d: string) => `• ${d}`).join("\n");

    let prompt = "";
    if (formato === "card") {
      prompt = `Crie um infográfico vertical 1080x1350 (formato post Instagram) para uso em redes sociais sobre legislativo brasileiro.

TÍTULO PRINCIPAL: ${dados.titulo}
${dados.subtitulo ? `SUBTÍTULO: ${dados.subtitulo}` : ""}

MÉTRICAS PRINCIPAIS (use grandes, em destaque visual):
${metricasStr}

${destaquesStr ? `DESTAQUES:\n${destaquesStr}` : ""}

${dados.rodape ? `RODAPÉ: ${dados.rodape}` : ""}

ESTILO VISUAL:
- Design profissional, moderno, jornalístico (estilo The Economist / Politico)
- Paleta: azul-índigo profundo (#4F46E5), verde-esmeralda (#10B981), vermelho (#E11D48), fundo branco/off-white
- Tipografia bold e impactante para números, sans-serif limpa para textos
- Use ícones simples e geometria moderna
- Destaque os números em escala grande (60-120pt)
- Hierarquia visual clara, espaçamento generoso
- NÃO use textos longos. Apenas labels curtos e os valores numéricos.
- TODOS os textos devem estar em PORTUGUÊS BRASILEIRO, com acentuação correta`;
    } else {
      prompt = `Crie um relatório analítico visual A4 (1240x1754) sobre legislativo brasileiro, denso de dados.

TÍTULO: ${dados.titulo}
${dados.subtitulo ? `SUBTÍTULO: ${dados.subtitulo}` : ""}

MÉTRICAS:
${metricasStr}

${destaquesStr ? `OBSERVAÇÕES:\n${destaquesStr}` : ""}

${dados.rodape ? `FONTE/RODAPÉ: ${dados.rodape}` : ""}

ESTILO:
- Layout estilo dashboard executivo / relatório McKinsey
- Múltiplas seções: cabeçalho, KPIs grandes no topo, gráficos abstratos no meio (barras, donut, linha), insights na base
- Paleta sóbria: azul marinho, cinza-grafite, verde, vermelho de destaque
- Tipografia serifada para títulos, sans para dados
- Use ícones e elementos visuais minimalistas
- TODOS os textos em PORTUGUÊS BRASILEIRO`;
    }

    // Chamada DIRETA à API do Google AI Studio (não via Lovable)
    const model = "gemini-2.5-flash-image-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          temperature: 0.8,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini error", resp.status, errText);
      const status = resp.status === 429 ? 429 : resp.status === 403 ? 402 : 500;
      const msg = resp.status === 429
        ? "Limite de requisições da API Gemini excedido. Tente novamente em alguns minutos."
        : resp.status === 403
        ? "Chave Gemini inválida ou sem permissão."
        : `Erro Gemini: ${resp.status}`;
      return new Response(JSON.stringify({ error: msg, detail: errText.slice(0, 500) }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    // Extrai a primeira parte com inlineData (imagem)
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p.inlineData || p.inline_data);
    const inline = imgPart?.inlineData || imgPart?.inline_data;

    if (!inline?.data) {
      console.error("No image returned", JSON.stringify(json).slice(0, 800));
      return new Response(JSON.stringify({ error: "Gemini não retornou imagem", raw: json }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mime = inline.mimeType || inline.mime_type || "image/png";
    const dataUrl = `data:${mime};base64,${inline.data}`;

    return new Response(JSON.stringify({ image: dataUrl, model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gerar-infografico error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});