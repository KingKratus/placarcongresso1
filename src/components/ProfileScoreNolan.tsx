import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { applyWeights, useCustomWeights, usePerformanceScore, deriveAutoriaScore } from "@/hooks/usePerformanceScore";
import { NolanDiagram } from "./NolanDiagram";

interface Props {
  parlamentar_id: number;
  casa: "camara" | "senado";
  ano: number;
  nome: string;
}

/**
 * Compact profile widget showing P-Score (with optional Autoria weight applied)
 * + Nolan Diagram side-by-side. Used directly inside DeputadoDetail / SenadorDetail
 * so users see the score and ideological position without navigating to the Desempenho tab.
 */
export function ProfileScoreNolan({ parlamentar_id, casa, ano, nome }: Props) {
  const { data, loading } = usePerformanceScore(parlamentar_id, casa, ano);
  const { weights } = useCustomWeights();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <TrendingUp size={14} className="text-primary" /> P-Score Personalizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Carregando…</p>
          ) : !data ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Score ainda não calculado. Vá em <Badge variant="secondary" className="text-[10px]">Desempenho</Badge> e clique em <strong>Calcular agora</strong>.
            </p>
          ) : (() => {
            const customScore = applyWeights(data, weights);
            const T = deriveAutoriaScore(data);
            const dims = [
              { label: "Alinhamento", v: Number(data.score_alinhamento), w: weights.A },
              { label: "Presença", v: Number(data.score_presenca), w: weights.P },
              { label: "Impacto", v: Number(data.score_impacto), w: weights.I },
              { label: "Engajamento", v: Number(data.score_engajamento), w: weights.E },
              { label: "Autoria (opcional)", v: T, w: weights.T || 0 },
            ];
            const raw = (data.dados_brutos as any)?.impacto || {};
            return (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-4xl font-black tabular-nums">{customScore.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Padrão: {Number(data.score_total).toFixed(1)} / 100
                  </p>
                </div>
                <div className="space-y-1.5">
                  {dims.map((d) => (
                    <div key={d.label}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="font-medium">
                          {d.label}
                          {d.w > 0 && <span className="text-muted-foreground ml-1">·{(d.w * 100).toFixed(0)}%</span>}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{(d.v * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={d.v * 100} className="h-1.5" />
                    </div>
                  ))}
                </div>
                {(raw.autoria || raw.coautoria) && (
                  <div className="flex gap-1.5 justify-center pt-1 flex-wrap">
                    <Badge className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      {raw.autoria || 0} autor
                    </Badge>
                    <Badge className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                      {raw.coautoria || 0} co-autor
                    </Badge>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <NolanDiagram parlamentar_id={parlamentar_id} casa={casa} ano={ano} nome={nome} />
    </div>
  );
}
