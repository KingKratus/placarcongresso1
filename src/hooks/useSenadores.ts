import { useState, useEffect } from "react";

const SENADO_API = "https://legis.senado.leg.br/dadosabertos";

export interface Senador {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
  email?: string;
}

export function useSenadores() {
  const [senadores, setSenadores] = useState<Senador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${SENADO_API}/senador/lista/atual`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Falha ao carregar lista de senadores");
        const json = await res.json();
        const parlamentares =
          json?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];

        const list: Senador[] = (Array.isArray(parlamentares) ? parlamentares : [parlamentares]).map(
          (p: any) => {
            const id = p?.IdentificacaoParlamentar || {};
            return {
              id: Number(id.CodigoParlamentar),
              nome: id.NomeParlamentar || "",
              siglaPartido: id.SiglaPartidoParlamentar || "",
              siglaUf: id.UfParlamentar || "",
              urlFoto: id.UrlFotoParlamentar || "",
              email: id.EmailParlamentar || undefined,
            };
          }
        );

        setSenadores(list.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (err: any) {
        setError("Falha ao carregar dados da API do Senado.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { senadores, loading, error };
}
