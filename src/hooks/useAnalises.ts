import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

export function useAnalises(ano: number) {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalises = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("analises_deputados")
      .select("*")
      .eq("ano", ano)
      .order("score", { ascending: false });

    if (err) {
      setError("Erro ao carregar análises do banco.");
    } else {
      setAnalises(data || []);
    }
    setLoading(false);
  }, [ano]);

  useEffect(() => {
    fetchAnalises();
  }, [fetchAnalises]);

  const syncDeputados = useCallback(
    async (runId?: string) => {
      setSyncing(true);
      setError(null);
      try {
        const body: any = { ano };
        if (runId) body.run_id = runId;

        const { data, error: err } = await supabase.functions.invoke(
          "sync-camara",
          { body }
        );
        if (err) {
          let msg = err.message || "Erro ao sincronizar com a API da Câmara.";
          try {
            if (err.context?.body) {
              const reader = err.context.body.getReader();
              const { value } = await reader.read();
              const body = JSON.parse(new TextDecoder().decode(value));
              if (body?.error) msg = body.error;
            }
          } catch {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        await fetchAnalises();
        return data;
      } catch (e: any) {
        setError(e.message || "Erro ao sincronizar com a API da Câmara.");
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [ano, fetchAnalises]
  );

  return { analises, loading, syncing, error, syncDeputados, refetch: fetchAnalises };
}
