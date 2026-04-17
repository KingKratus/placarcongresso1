import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyWeights, useCustomWeights, usePerformanceScore, DEFAULT_WEIGHTS } from "@/hooks/usePerformanceScore";
import { PerformanceWeightsCustomizer } from "./PerformanceWeightsCustomizer";
import { toast } from "sonner";

interface Props {
  parlamentar_id: number;
  casa: "camara" | "senado";
  ano: number;
}

const DIM_LABELS: Record<string, { label: string; color: string }> = {
  A: { label: "Alinhamento", color: "bg-blue-500" },
  P: { label: "Presença", color: "bg-emerald-500" },
  I: { label: "Impacto", color: "bg-amber-500" },
  E: { label: "Engajamento", color: "bg-purple-500" },
};

export function PerformanceTab({ parlamentar_id, casa, ano }: Props) {
  const { data, loading } = usePerformanceScore(parlamentar_id, casa, ano);
  const { weights } = useCustomWeights();
  const [calculating, setCalculating] = useState(false);
  const [tick, setTick] = useState(0);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const { error } = await supabase.functions.invoke("calculate-performance", {
        body: { ano, casa, limit: 100 },
      });
      if (error) throw error;
      toast.success("Cálculo iniciado. Recarregue em alguns segundos.");
      setTimeout(() => setTick((t) => t + 1), 3000);
    } catch (e: any) {
      toast.error("Erro ao calcular: " + (e.message || "desconhecido"));
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Score de Desempenho ainda não calculado para este parlamentar em {ano}.
          </p>
          <Button onClick={handleCalculate} disabled={calculating} key={tick}>
            {calculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Calcular agora
          </Button>
        </CardContent>
      </Card>
    );
  }

  const customScore = applyWeights(data, weights);
  const isCustom = JSON.stringify(weights) !== JSON.stringify(DEFAULT_WEIGHTS);

  const dims = [
    { key: "A", value: Number(data.score_alinhamento) },
    { key: "P", value: Number(data.score_presenca) },
    { key: "I", value: Number(data.score_impacto) },
    { key: "E", value: Number(data.score_engajamento) },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Score de Desempenho — {ano}</CardTitle>
            {isCustom && <Badge variant="secondary" className="text-xs">Pesos customizados</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-5xl font-bold tabular-nums">{customScore.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Padrão: {Number(data.score_total).toFixed(1)} / 100
            </div>
          </div>

          <div className="space-y-3">
            {dims.map((d) => {
              const meta = DIM_LABELS[d.key];
              const pct = d.value * 100;
              return (
                <div key={d.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{meta.label}</span>
                    <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={handleCalculate} disabled={calculating} className="w-full">
            {calculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Recalcular
          </Button>
        </CardContent>
      </Card>

      <PerformanceWeightsCustomizer />
    </div>
  );
}
