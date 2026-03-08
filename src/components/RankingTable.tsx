import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface RankingTableProps {
  analises: Analise[];
}

export function RankingTable({ analises }: RankingTableProps) {
  const sorted = [...analises].filter((a) => a.classificacao !== "Sem Dados");
  const top10 = [...sorted].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 10);
  const bottom10 = [...sorted].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 10);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp size={16} className="text-governo" />
            Top 10 Mais Alinhados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {top10.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-governo/5">
              <span className="text-xs font-black text-governo w-6">{i + 1}°</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{a.deputado_nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {a.deputado_partido} - {a.deputado_uf}
                </p>
              </div>
              <span className="text-sm font-black text-governo">
                {Number(a.score).toFixed(1)}%
              </span>
            </div>
          ))}
          {top10.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sincronize dados para ver o ranking
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown size={16} className="text-oposicao" />
            Top 10 Mais Oposicionistas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bottom10.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-oposicao/5">
              <span className="text-xs font-black text-oposicao w-6">{i + 1}°</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{a.deputado_nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {a.deputado_partido} - {a.deputado_uf}
                </p>
              </div>
              <span className="text-sm font-black text-oposicao">
                {Number(a.score).toFixed(1)}%
              </span>
            </div>
          ))}
          {bottom10.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sincronize dados para ver o ranking
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
