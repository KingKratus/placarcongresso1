import { useState, useEffect } from "react";

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

export function useDeputados(legislatura: number = 57) {
  const [deputados, setDeputados] = useState<Deputado[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [depRes, partRes] = await Promise.all([
          fetch(`${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600&idLegislatura=${legislatura}`),
          fetch(`${API_BASE}/partidos?itens=100&ordem=ASC&ordenarPor=sigla`),
        ]);
        const depData = await depRes.json();
        const partData = await partRes.json();
        if (!depData.dados) throw new Error("API não retornou dados.");
        setDeputados(depData.dados || []);
        setPartidos(partData.dados || []);
      } catch (err: any) {
        setError("Falha ao carregar dados da API da Câmara.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [legislatura]);

  return { deputados, partidos, loading, error };
}
