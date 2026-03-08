import { useState, useEffect } from "react";

const API_BASE = "https://legis.senado.leg.br/dadosabertos";

export interface Senador {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
}

export interface PartidoSenado {
  sigla: string;
}

export function useSenadores() {
  const [senadores, setSenadores] = useState<Senador[]>([]);
  const [partidos, setPartidos] = useState<PartidoSenado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/senador/lista/atual.json`);
        if (!res.ok) throw new Error("Falha ao buscar senadores");
        const json = await res.json();

        const parlamentares =
          json?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];
        const arr = Array.isArray(parlamentares) ? parlamentares : [parlamentares];

        const mapped: Senador[] = arr.map((p: any) => {
          const id = p.IdentificacaoParlamentar || {};
          return {
            id: Number(id.CodigoParlamentar),
            nome: id.NomeParlamentar || id.NomeCompletoParlamentar || "",
            siglaPartido: id.SiglaPartidoParlamentar || "",
            siglaUf: id.UfParlamentar || "",
            urlFoto: id.UrlFotoParlamentar || "",
          };
        });

        mapped.sort((a, b) => a.nome.localeCompare(b.nome));
        setSenadores(mapped);

        const partidoSet = new Set(mapped.map((s) => s.siglaPartido).filter(Boolean));
        setPartidos(
          [...partidoSet].sort().map((sigla) => ({ sigla }))
        );
      } catch (err: any) {
        setError("Falha ao carregar dados da API do Senado.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { senadores, partidos, loading, error };
}
