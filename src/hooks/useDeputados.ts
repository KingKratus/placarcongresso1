import { useState, useEffect, useRef } from "react";

const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

export interface Deputado {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
  email?: string;
}

export interface Partido {
  id: number;
  sigla: string;
  nome: string;
}

export function useDeputados(legislatura?: number) {
  const [deputados, setDeputados] = useState<Deputado[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const depUrl = legislatura
          ? `${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600&idLegislatura=${legislatura}`
          : `${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600`;

        const [depRes, partRes] = await Promise.all([
          fetch(depUrl, { signal: controller.signal }),
          fetch(`${API_BASE}/partidos?itens=100&ordem=ASC&ordenarPor=sigla`, { signal: controller.signal }),
        ]);
        const depData = await depRes.json();
        const partData = await partRes.json();
        if (!depData.dados) throw new Error("API não retornou dados.");
        if (!controller.signal.aborted) {
          setDeputados(depData.dados || []);
          setPartidos(partData.dados || []);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError("Falha ao carregar dados da API da Câmara.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    load();

    return () => controller.abort();
  }, [legislatura]);

  return { deputados, partidos, loading, error };
}
