import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PerformanceScore = Tables<"deputy_performance_scores">;

// A=Alinhamento, P=Presença, I=Impacto, E=Engajamento, T=Autoria (proposições) — opcional
export const DEFAULT_WEIGHTS = { A: 0.25, P: 0.25, I: 0.30, E: 0.20, T: 0 };
const STORAGE_KEY = "perf_weights_v2";

export function loadWeights(): typeof DEFAULT_WEIGHTS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WEIGHTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_WEIGHTS, ...parsed };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function saveWeights(w: typeof DEFAULT_WEIGHTS) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
}

export function resetWeights() {
  localStorage.removeItem(STORAGE_KEY);
}

export function usePerformanceScore(parlamentar_id?: number, casa?: string, ano?: number) {
  const [data, setData] = useState<PerformanceScore | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parlamentar_id || !casa || !ano) return;
    setLoading(true);
    supabase
      .from("deputy_performance_scores")
      .select("*")
      .eq("parlamentar_id", parlamentar_id)
      .eq("casa", casa)
      .eq("ano", ano)
      .maybeSingle()
      .then(({ data }) => {
        setData(data);
        setLoading(false);
      });
  }, [parlamentar_id, casa, ano]);

  return { data, loading };
}

export function deriveAutoriaScore(s: PerformanceScore): number {
  // Bonus opcional baseado em proposições: peso autor=1, co-autor=0.5; satura em ~20 ponderadas
  const raw = (s.dados_brutos as any)?.impacto || {};
  const autoria = Number(raw.autoria || 0);
  const coautoria = Number(raw.coautoria || 0);
  const ponderado = autoria + coautoria * 0.5;
  return Math.min(1, ponderado / 20);
}

export function applyWeights(s: PerformanceScore, w: typeof DEFAULT_WEIGHTS): number {
  const total = w.A + w.P + w.I + w.E + (w.T || 0) || 1;
  const T = deriveAutoriaScore(s);
  const score =
    (Number(s.score_alinhamento) * w.A +
      Number(s.score_presenca) * w.P +
      Number(s.score_impacto) * w.I +
      Number(s.score_engajamento) * w.E +
      T * (w.T || 0)) /
    total;
  return Math.round(score * 1000) / 10;
}

export function useCustomWeights() {
  const [weights, setWeights] = useState(loadWeights());
  const update = (next: typeof DEFAULT_WEIGHTS) => {
    setWeights(next);
    saveWeights(next);
  };
  const reset = () => {
    resetWeights();
    setWeights(DEFAULT_WEIGHTS);
  };
  return { weights, update, reset, isDefault: useMemo(() =>
    weights.A === DEFAULT_WEIGHTS.A && weights.P === DEFAULT_WEIGHTS.P &&
    weights.I === DEFAULT_WEIGHTS.I && weights.E === DEFAULT_WEIGHTS.E &&
    (weights.T || 0) === DEFAULT_WEIGHTS.T, [weights]) };
}
