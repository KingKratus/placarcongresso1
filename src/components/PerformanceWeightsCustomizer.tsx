import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { DEFAULT_WEIGHTS, useCustomWeights } from "@/hooks/usePerformanceScore";

const LABELS: Record<keyof typeof DEFAULT_WEIGHTS, string> = {
  A: "Alinhamento",
  P: "Presença",
  I: "Impacto Legislativo",
  E: "Engajamento em Comissões",
};

export function PerformanceWeightsCustomizer({ onChange }: { onChange?: (w: typeof DEFAULT_WEIGHTS) => void }) {
  const { weights, update, reset, isDefault } = useCustomWeights();
  const sum = weights.A + weights.P + weights.I + weights.E;

  const setKey = (k: keyof typeof DEFAULT_WEIGHTS, val: number) => {
    const next = { ...weights, [k]: val };
    update(next);
    onChange?.(next);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Pesos do Score (avançado)</CardTitle>
        <Button variant="ghost" size="sm" disabled={isDefault} onClick={() => { reset(); onChange?.(DEFAULT_WEIGHTS); }}>
          <RotateCcw className="h-3 w-3 mr-1" /> Padrão
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(LABELS) as (keyof typeof DEFAULT_WEIGHTS)[]).map((k) => (
          <div key={k}>
            <div className="flex justify-between mb-1">
              <Label className="text-xs">{LABELS[k]}</Label>
              <span className="text-xs text-muted-foreground tabular-nums">{(weights[k] * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[weights[k] * 100]}
              max={100} step={5}
              onValueChange={(v) => setKey(k, v[0] / 100)}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Soma: {(sum * 100).toFixed(0)}% (valores são auto-normalizados no cálculo)
        </p>
      </CardContent>
    </Card>
  );
}
