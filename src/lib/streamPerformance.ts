import { supabase } from "@/integrations/supabase/client";

export type PerfStreamEvent =
  | { type: "start"; total: number; casa: string; ano: number }
  | { type: "progress"; current: number; total: number; parlamentar_id: number; nome: string | null; partido: string | null; uf: string | null; score_total: number; elapsed_ms: number }
  | { type: "flush"; upserted: number; accumulated: number }
  | { type: "done"; processed: number }
  | { type: "error"; message: string };

interface StreamOptions {
  casa: "camara" | "senado";
  ano: number;
  limit?: number;
  parlamentar_ids?: number[];
  onEvent: (e: PerfStreamEvent) => void;
  signal?: AbortSignal;
}

/**
 * Streams real-time progress from calculate-performance via Server-Sent Events.
 * Falls back gracefully if the response isn't event-stream.
 */
export async function streamPerformance(opts: StreamOptions): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = `${supaUrl}/functions/v1/calculate-performance?stream=1`;

  const res = await fetch(url, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "apikey": anonKey,
      "Authorization": `Bearer ${session?.access_token ?? anonKey}`,
    },
    body: JSON.stringify({
      casa: opts.casa,
      ano: opts.ano,
      limit: opts.limit,
      parlamentar_ids: opts.parlamentar_ids,
    }),
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    opts.onEvent({ type: "error", message: `HTTP ${res.status}: ${txt.slice(0, 200)}` });
    return;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    // JSON fallback
    const j = await res.json().catch(() => ({}));
    opts.onEvent({ type: "done", processed: j?.processed ?? 0 });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE blocks separated by \n\n
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let eventType = "message";
      let dataLine = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      try {
        const data = JSON.parse(dataLine);
        opts.onEvent({ type: eventType as PerfStreamEvent["type"], ...data } as PerfStreamEvent);
      } catch {
        // Ignore malformed event
      }
    }
  }
}
