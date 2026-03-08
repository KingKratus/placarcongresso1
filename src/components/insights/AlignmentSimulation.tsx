import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type AnaliseDeputado = Tables<"analises_deputados">;
type AnaliseSenador = Tables<"analises_senadores">;

interface Props {
  allYearsDeputados: AnaliseDeputado[];
  allYearsSenadores: AnaliseSenador[];
}

const CLASS_COLORS: Record<string, string> = {
  Governo: "hsl(160, 84%, 39%)",
  Oposição: "hsl(347, 77%, 50%)",
  Centro: "hsl(239, 84%, 67%)",
  "Sem Dados": "hsl(215, 16%, 47%)",
};

const DEFAULT_GOV = 50;
const DEFAULT_OPO = 30;

function classify(score: number, govThreshold: number, opoThreshold: number): string {
  if (score >= govThreshold) return "Governo";
  if (score <= opoThreshold) return "Oposição";
  return "Centro";
}

export function AlignmentSimulation({ allYearsDeputados, allYearsSenadores }: Props) {
  const [govThreshold, setGovThreshold] = useState(DEFAULT_GOV);
  const [opoThreshold, setOpoThreshold] = useState(DEFAULT_OPO);
  const [showConfig, setShowConfig] = useState(false);

  const isCustom = govThreshold !== DEFAULT_GOV || opoThreshold !== DEFAULT_OPO;

  const resetThresholds = () => {
    setGovThreshold(DEFAULT_GOV);
    setOpoThreshold(DEFAULT_OPO);
  };

  // Reclassify using custom thresholds
  const { data, latest } = useMemo(() => {
    const years = new Set<number>();
    allYearsDeputados.forEach((d) => years.add(d.ano));
    allYearsSenadores.forEach((s) => years.add(s.ano));

    const result = Array.from(years).sort().map((ano) => {
      const allScores = [
        ...allYearsDeputados.filter((d) => d.ano === ano).map((d) => Number(d.score)),
        ...allYearsSenadores.filter((s) => s.ano === ano).map((s) => Number(s.score)),
      ];
      const total = allScores.length;
      if (total === 0) return null;

      let gov = 0, cen = 0, opo = 0, sem = 0;
      allScores.forEach((score) => {
        if (score === 0) { sem++; return; }
        const cls = classify(score, govThreshold, opoThreshold);
        if (cls === "Governo") gov++;
        else if (cls === "Centro") cen++;
        else opo++;
      });

      return {
        ano,
        Governo: Math.round((gov / total) * 100),
        Centro: Math.round((cen / total) * 100),
        Oposição: Math.round((opo / total) * 100),
        "Sem Dados": Math.round((sem / total) * 100),
        govCount: gov,
        cenCount: cen,
        opoCount: opo,
        semCount: sem,
        total,
      };
    }).filter(Boolean) as Array<{
      ano: number; Governo: number; Centro: number; Oposição: number; "Sem Dados": number;
      govCount: number; cenCount: number; opoCount: number; semCount: number; total: number;
    }>;

    return { data: result, latest: result[result.length - 1] || null };
  }, [allYearsDeputados, allYearsSenadores, govThreshold, opoThreshold]);

  if (!latest) return null;

  const pieData = [
    { name: "Governo", value: latest.govCount },
    { name: "Centro", value: latest.cenCount },
    { name: "Oposição", value: latest.opoCount },
    { name: "Sem Dados", value: latest.semCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Config Panel */}
      <Card className={`border-2 transition-colors ${isCustom ? "border-primary/30 bg-primary/5" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-primary" />
              Simulação de Cenários
              {isCustom && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
                  Personalizado
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {isCustom && (
                <Button variant="ghost" size="sm" onClick={resetThresholds} className="gap-1 text-xs">
                  <RotateCcw size={12} /> Resetar
                </Button>
              )}
              <Button
                variant={showConfig ? "default" : "outline"}
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs"
              >
                {showConfig ? "Fechar" : "Ajustar Faixas"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showConfig && (
          <CardContent className="space-y-6 pt-2">
            <p className="text-xs text-muted-foreground">
              Ajuste os limites de score para reclassificar os parlamentares em tempo real.
              Veja como a composição muda com diferentes critérios.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-governo uppercase tracking-wider">
                    Governo ≥
                  </label>
                  <span className="text-sm font-black text-governo bg-governo/10 px-2 py-0.5 rounded-md">
                    {govThreshold}%
                  </span>
                </div>
                <Slider
                  value={[govThreshold]}
                  onValueChange={([v]) => {
                    if (v > opoThreshold + 5) setGovThreshold(v);
                  }}
                  min={10}
                  max={95}
                  step={5}
                  className="[&_[role=slider]]:bg-governo"
                />
                <p className="text-[10px] text-muted-foreground">
                  Parlamentares com score ≥ {govThreshold}% são classificados como Governo
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-oposicao uppercase tracking-wider">
                    Oposição ≤
                  </label>
                  <span className="text-sm font-black text-oposicao bg-oposicao/10 px-2 py-0.5 rounded-md">
                    {opoThreshold}%
                  </span>
                </div>
                <Slider
                  value={[opoThreshold]}
                  onValueChange={([v]) => {
                    if (v < govThreshold - 5) setOpoThreshold(v);
                  }}
                  min={5}
                  max={90}
                  step={5}
                  className="[&_[role=slider]]:bg-oposicao"
                />
                <p className="text-[10px] text-muted-foreground">
                  Parlamentares com score ≤ {opoThreshold}% são classificados como Oposição
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Faixas resultantes</p>
              <div className="flex gap-3 text-xs font-semibold">
                <span className="text-governo">Governo: ≥{govThreshold}%</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-centro">Centro: {opoThreshold + 1}%–{govThreshold - 1}%</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-oposicao">Oposição: ≤{opoThreshold}%</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução da Composição (% por Ano)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Bar dataKey="Governo" stackId="a" fill={CLASS_COLORS.Governo} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Centro" stackId="a" fill={CLASS_COLORS.Centro} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Oposição" stackId="a" fill={CLASS_COLORS.Oposição} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Composição Atual — {latest.ano}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={CLASS_COLORS[entry.name] || "#999"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v} parlamentares`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg p-2 bg-governo/10 border border-governo/20">
                <p className="text-lg font-black text-governo">{latest.Governo}%</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Governo</p>
                <p className="text-xs text-foreground font-semibold">{latest.govCount}</p>
              </div>
              <div className="rounded-lg p-2 bg-centro/10 border border-centro/20">
                <p className="text-lg font-black text-centro">{latest.Centro}%</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Centro</p>
                <p className="text-xs text-foreground font-semibold">{latest.cenCount}</p>
              </div>
              <div className="rounded-lg p-2 bg-oposicao/10 border border-oposicao/20">
                <p className="text-lg font-black text-oposicao">{latest.Oposição}%</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Oposição</p>
                <p className="text-xs text-foreground font-semibold">{latest.opoCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
