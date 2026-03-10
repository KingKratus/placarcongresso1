import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_senadores">;

export function useAnalisesSenado(ano: number) {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalises = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("analises_senadores")
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

  const syncSenadores = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke(
        "sync-senado",
        { body: { ano } }
      );
      if (err) {
        let msg = err.message || "Erro ao sincronizar com a API do Senado.";
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
      setError(e.message || "Erro ao sincronizar com a API do Senado.");
      return null;
    } finally {
      setSyncing(false);
    }
  }, [ano, fetchAnalises]);

  return { analises, loading, syncing, error, syncSenadores, refetch: fetchAnalises };
}
