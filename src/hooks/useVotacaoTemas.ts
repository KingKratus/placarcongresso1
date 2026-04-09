import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VotacaoTema {
  id: string;
  votacao_id: string;
  casa: string;
  tema: string;
  confianca: number;
  ano: number;
}

export const TEMAS_DISPONIVEIS = [
  "Econômico",
  "Social",
  "Segurança",
  "Educação",
  "Saúde",
  "Meio Ambiente",
  "Infraestrutura",
  "Político-Institucional",
  "Trabalhista",
  "Tributário",
  "Outros",
];

export function useVotacaoTemas(ano: number, casa: "camara" | "senado") {
  const [temas, setTemas] = useState<VotacaoTema[]>([]);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);

  const fetchTemas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("votacao_temas")
      .select("*")
      .eq("ano", ano)
      .eq("casa", casa);
    setTemas((data as VotacaoTema[]) || []);
    setLoading(false);
  }, [ano, casa]);

  useEffect(() => {
    fetchTemas();
  }, [fetchTemas]);

  const classify = useCallback(async () => {
    setClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("classify-votacoes", {
        body: { ano, casa },
      });
      if (error) throw error;
      await fetchTemas();
      return data;
    } catch (e) {
      console.error("Classification error:", e);
      return null;
    } finally {
      setClassifying(false);
    }
  }, [ano, casa, fetchTemas]);

  // Map: votacao_id -> tema
  const temaMap = new Map(temas.map((t) => [t.votacao_id, t.tema]));

  // Available themes in current data
  const temasAtivos = [...new Set(temas.map((t) => t.tema))].sort();

  return { temas, temaMap, temasAtivos, loading, classifying, classify, refetch: fetchTemas };
}
