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

    // Imagen prompts must be in English; rendered text inside the image can be Portuguese.
    const aspectRatio = formato === "card" ? "3:4" : "9:16";
    const styleDirective = formato === "card"
      ? "Vertical Instagram-style social infographic poster, modern editorial design (The Economist / Politico aesthetic). Bold sans-serif typography, huge numeric figures (80-120pt), clean white background, accent colors deep indigo blue, emerald green, crimson red. Minimal icons, generous whitespace, sharp visual hierarchy."
      : "Executive analytical dashboard report (McKinsey / consulting style). Multiple sections with header, large KPI tiles, abstract chart elements (bars, donut, line), insight callouts. Sober palette: navy blue, graphite gray, accent emerald and red. Serif headings, sans-serif data. Minimalist icons.";

    const textBlock = [
      `TITLE (render exactly, in Portuguese, large bold): "${dados.titulo}"`,
      dados.subtitulo ? `SUBTITLE (Portuguese): "${dados.subtitulo}"` : "",
      `KEY METRICS (render each as a big number with its short label, in Portuguese, exactly as written):\n${metricasStr}`,
      destaquesStr ? `HIGHLIGHTS (small bullets, Portuguese):\n${destaquesStr}` : "",
      dados.rodape ? `FOOTER (small, Portuguese): "${dados.rodape}"` : "",
    ].filter(Boolean).join("\n\n");

    const prompt = `${styleDirective}

The infographic is about Brazilian legislative data. Render ALL TEXT EXACTLY AS PROVIDED below, keeping Portuguese spelling and accents intact (ã, ç, é, í, ó, ú, â, ê, ô). No translation. No extra text.

${textBlock}

No people, no photographs, no flags. Pure typographic editorial infographic. Crisp, print-ready, high resolution.`;

    // DIRECT call to Google AI Studio (Imagen 4) — NOT through Lovable AI gateway.
    const model = "imagen-4.0-generate-001";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          personGeneration: "dont_allow",
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini error", resp.status, errText);
      let msg = `Erro Gemini: ${resp.status}`;
      let status = 500;
      if (resp.status === 429) { msg = "Limite de requisições da API Gemini excedido. Tente novamente em alguns minutos."; status = 429; }
      else if (resp.status === 403) { msg = "Chave Gemini inválida ou sem permissão."; status = 402; }
      else if (errText.includes("only available on paid")) {
        msg = "Imagen requer um plano pago do Google AI Studio. Ative o billing em https://ai.dev/projects e tente novamente.";
        status = 402;
      }
      return new Response(JSON.stringify({ error: msg, detail: errText.slice(0, 500) }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    // Imagen :predict returns { predictions: [{ bytesBase64Encoded, mimeType }] }
    const pred = json?.predictions?.[0];
    const b64 = pred?.bytesBase64Encoded || pred?.image?.imageBytes;
    if (!b64) {
      console.error("No image returned", JSON.stringify(json).slice(0, 800));
      return new Response(JSON.stringify({ error: "Gemini não retornou imagem", raw: json }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mime = pred?.mimeType || "image/png";
    const dataUrl = `data:${mime};base64,${b64}`;

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