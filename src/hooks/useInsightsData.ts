import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AnaliseDeputado = Tables<"analises_deputados">;
type AnaliseSenador = Tables<"analises_senadores">;

interface VotacaoDate { data: string | null; }

const ALL_YEARS = [2023, 2024, 2025, 2026];

export function useInsightsData(ano: number) {
  const [deputados, setDeputados] = useState<AnaliseDeputado[]>([]);
  const [senadores, setSenadores] = useState<AnaliseSenador[]>([]);
  const [votacoesCamara, setVotacoesCamara] = useState<VotacaoDate[]>([]);
  const [votacoesSenado, setVotacoesSenado] = useState<VotacaoDate[]>([]);
  const [allYearsDeputados, setAllYearsDeputados] = useState<AnaliseDeputado[]>([]);
  const [allYearsSenadores, setAllYearsSenadores] = useState<AnaliseSenador[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.from("analises_deputados").select("*").eq("ano", ano).order("score", { ascending: false }).limit(2000),
      supabase.from("analises_senadores").select("*").eq("ano", ano).order("score", { ascending: false }).limit(500),
      supabase.from("votacoes").select("data").eq("ano", ano).limit(5000),
      supabase.from("votacoes_senado").select("data").eq("ano", ano).limit(5000),
      supabase.from("analises_deputados").select("*").in("ano", ALL_YEARS).order("ano", { ascending: true }).limit(5000),
      supabase.from("analises_senadores").select("*").in("ano", ALL_YEARS).order("ano", { ascending: true }).limit(2000),
    ]);
    setDeputados(r1.data || []);
    setSenadores(r2.data || []);
    setVotacoesCamara(r3.data || []);
    setVotacoesSenado(r4.data || []);
    setAllYearsDeputados(r5.data || []);
    setAllYearsSenadores(r6.data || []);
    setLoading(false);
  }, [ano]);

  useEffect(() => { fetch(); }, [fetch]);

  return { deputados, senadores, votacoesCamara, votacoesSenado, allYearsDeputados, allYearsSenadores, loading, refetch: fetch };
}
