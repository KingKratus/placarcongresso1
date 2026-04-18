import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

async function fetchCamaraStatus(tipo: string, numero: string, ano: number): Promise<string | null> {
  try {
    const url = `https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=${tipo}&numero=${numero}&ano=${ano}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    const id = j?.dados?.[0]?.id;
    if (!id) return null;
    const r2 = await fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}`, {
      headers: { Accept: "application/json" },
    });
    if (!r2.ok) return null;
    const j2 = await r2.json();
    return j2?.dados?.statusProposicao?.descricaoSituacao || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const casa = body.casa ?? "camara";
    const onlyMissing = body.onlyMissing ?? true;
    const limit = Math.min(body.limit ?? 500, 2000);
    const fetchStatus = body.fetchStatus ?? false;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let q = sb.from("proposicoes_parlamentares").select("*").eq("casa", casa).limit(limit);
    if (onlyMissing) q = q.or("peso_tipo.is.null,status_tramitacao.is.null");
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    for (const r of rows) {
      const peso = PESO_TIPO[r.tipo] ?? 0.3;
      let status = r.status_tramitacao;
      if (!status) {
        if (casa === "camara" && fetchStatus) {
          const raw = await fetchCamaraStatus(r.tipo, r.numero, r.ano);
          status = normalizeStatus(raw);
        } else {
          status = "Em tramitação";
        }
      }
      const { error: upErr } = await sb
        .from("proposicoes_parlamentares")
        .update({ peso_tipo: peso, status_tramitacao: status })
        .eq("id", r.id);
      if (!upErr) updated++;
    }

    return new Response(JSON.stringify({ ok: true, processed: updated, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reprocess-proposicoes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
