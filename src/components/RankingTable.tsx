import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Trophy, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;
type Perf = Tables<"deputy_performance_scores">;

interface RankingTableProps {
  analises: Analise[];
}

export function RankingTable({ analises }: RankingTableProps) {
  const [mode, setMode] = useState<"alinhamento" | "desempenho">("alinhamento");
  const [perfList, setPerfList] = useState<Perf[]>([]);

  useEffect(() => {
    if (mode !== "desempenho") return;
    const ano = analises[0]?.ano ?? new Date().getFullYear();
    supabase.from("deputy_performance_scores").select("*").eq("casa", "camara").eq("ano", ano)
      .order("score_total", { ascending: false }).limit(600)
      .then(({ data }) => setPerfList(data || []));
  }, [mode, analises]);

  const sorted = [...analises].filter((a) => a.classificacao !== "Sem Dados");
  const top10 = [...sorted].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 10);
  const bottom10 = [...sorted].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 10);

  const top10Perf = perfList.slice(0, 10);
  const top10Threshold = perfList.length > 0 ? Number(perfList[Math.floor(perfList.length * 0.1)]?.score_total ?? 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center bg-card p-2 rounded-xl border border-border">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ordenar por:</span>
        <Button size="sm" variant={mode === "alinhamento" ? "default" : "outline"} className="h-7 text-xs"
          onClick={() => setMode("alinhamento")}>
          <Trophy size={12} className="mr-1" /> Alinhamento
        </Button>
        <Button size="sm" variant={mode === "desempenho" ? "default" : "outline"} className="h-7 text-xs"
          onClick={() => setMode("desempenho")}>
          <Sparkles size={12} className="mr-1" /> Desempenho (P-Score)
        </Button>
      </div>

      {mode === "desempenho" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              Top 10 — Score de Desempenho
              {perfList.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {perfList.length} avaliados
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {top10Perf.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum score calculado. Abra o perfil de um deputado e clique em "Calcular agora" na aba Desempenho.
              </p>
            ) : (
              top10Perf.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
                  <span className="text-xs font-black text-primary w-6">{i + 1}°</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{p.partido} - {p.uf}</p>
                  </div>
                  {Number(p.score_total) >= top10Threshold && top10Threshold > 0 && (
                    <Badge className="text-[9px] bg-accent text-accent-foreground border-border">Top 10%</Badge>
                  )}
                  <span className="text-sm font-black text-primary tabular-nums">
                    {Number(p.score_total).toFixed(1)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : (
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
                    <p className="text-[10px] text-muted-foreground">{a.deputado_partido} - {a.deputado_uf}</p>
                  </div>
                  <span className="text-sm font-black text-governo">{Number(a.score).toFixed(1)}%</span>
                </div>
              ))}
              {top10.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sincronize dados para ver o ranking</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown size={16} className="text-oposicao" />
                Top 10 Menos Alinhados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bottom10.map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-oposicao/5">
                  <span className="text-xs font-black text-oposicao w-6">{i + 1}°</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.deputado_nome}</p>
                    <p className="text-[10px] text-muted-foreground">{a.deputado_partido} - {a.deputado_uf}</p>
                  </div>
                  <span className="text-sm font-black text-oposicao">{Number(a.score).toFixed(1)}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
