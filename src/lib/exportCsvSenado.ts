import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_senadores">;

export function exportAnalisesSenadorCsv(analises: Analise[], ano: number) {
  const header = "Nome,Partido,UF,Score,Votos Úteis,Votos Alinhados,Classificação,Ano";
  const rows = analises.map((a) =>
    [
      `"${a.senador_nome}"`,
      a.senador_partido || "",
      a.senador_uf || "",
      Number(a.score).toFixed(2),
      a.total_votos,
      a.votos_alinhados,
      a.classificacao,
      a.ano,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `monitor-senado-${ano}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
