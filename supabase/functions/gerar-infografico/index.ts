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

    // 1) Tenta Imagen 4 (predict)
    const tryImagen = async (model: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio, personGeneration: "dont_allow" },
        }),
      });
      const txt = await r.text();
      let json: any = null;
      try { json = JSON.parse(txt); } catch { /* keep txt */ }
      return { ok: r.ok, status: r.status, text: txt, json };
    };

    // 2) Fallback gemini-2.5-flash-image-preview (generateContent multimodal)
    const tryGeminiImage = async () => {
      const model = "gemini-2.5-flash-image-preview";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      });
      const txt = await r.text();
      let json: any = null;
      try { json = JSON.parse(txt); } catch { /* keep txt */ }
      const inline = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData)?.inlineData;
      return { ok: r.ok && !!inline, status: r.status, text: txt, b64: inline?.data, mime: inline?.mimeType, model };
    };

    let resp = await tryImagen("imagen-4.0-generate-001");
    let dataUrl: string | null = null;
    let usedModel = "imagen-4.0-generate-001";

    if (resp.ok) {
      const pred = resp.json?.predictions?.[0];
      const b64 = pred?.bytesBase64Encoded || pred?.image?.imageBytes;
      const mime = pred?.mimeType || "image/png";
      if (b64) dataUrl = `data:${mime};base64,${b64}`;
    } else {
      console.warn("Imagen falhou, tentando fallback. status:", resp.status, "msg:", resp.text.slice(0, 300));
      // Fallback se for billing/permissão
      const isBilling = resp.status === 403 || resp.text.includes("only available on paid") || resp.text.includes("billing");
      const isQuota = resp.status === 429;
      if (isBilling || isQuota || resp.status === 400 || resp.status === 404) {
        const fb = await tryGeminiImage();
        if (fb.ok && fb.b64) {
          dataUrl = `data:${fb.mime || "image/png"};base64,${fb.b64}`;
          usedModel = fb.model;
        } else {
          console.error("Fallback também falhou:", fb.status, fb.text.slice(0, 300));
        }
      }
    }

    if (!dataUrl) {
      let msg = "Não foi possível gerar a imagem com Gemini.";
      let status = 500;
      if (resp.status === 429) { msg = "Limite de requisições da API Gemini excedido. Tente novamente em alguns minutos."; status = 429; }
      else if (resp.status === 403) { msg = "Chave Gemini inválida ou sem permissão."; status = 402; }
      else if (resp.text.includes("only available on paid")) {
        msg = "Imagen requer plano pago do Google AI Studio. Ative billing em https://ai.dev/projects.";
        status = 402;
      }
      return new Response(JSON.stringify({ error: msg, detail: resp.text.slice(0, 500) }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ image: dataUrl, model: usedModel }), {
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