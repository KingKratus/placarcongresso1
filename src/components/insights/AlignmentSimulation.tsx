import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function computeData(
  records: { score: number; ano: number }[],
  govThreshold: number,
  opoThreshold: number
) {
  const years = new Set<number>();
  records.forEach((r) => years.add(r.ano));

  const result = Array.from(years).sort().map((ano) => {
    const scores = records.filter((r) => r.ano === ano).map((r) => r.score);
    const total = scores.length;
    if (total === 0) return null;

    let gov = 0, cen = 0, opo = 0, sem = 0;
    scores.forEach((score) => {
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
      govCount: gov, cenCount: cen, opoCount: opo, semCount: sem, total,
    };
  }).filter(Boolean) as any[];

  return { data: result, latest: result[result.length - 1] || null };
}

export function AlignmentSimulation({ allYearsDeputados, allYearsSenadores }: Props) {
  const [govThreshold, setGovThreshold] = useState(DEFAULT_GOV);
  const [opoThreshold, setOpoThreshold] = useState(DEFAULT_OPO);
  const [showConfig, setShowConfig] = useState(false);
  const [casa, setCasa] = useState<"ambos" | "camara" | "senado">("ambos");

  const isCustom = govThreshold !== DEFAULT_GOV || opoThreshold !== DEFAULT_OPO;

  const resetThresholds = () => {
    setGovThreshold(DEFAULT_GOV);
    setOpoThreshold(DEFAULT_OPO);
  };

  const { data, latest } = useMemo(() => {
    let records: { score: number; ano: number }[] = [];
    if (casa === "ambos" || casa === "camara") {
      records.push(...allYearsDeputados.map((d) => ({ score: Number(d.score), ano: d.ano })));
    }
    if (casa === "ambos" || casa === "senado") {
      records.push(...allYearsSenadores.map((s) => ({ score: Number(s.score), ano: s.ano })));
    }
    return computeData(records, govThreshold, opoThreshold);
  }, [allYearsDeputados, allYearsSenadores, govThreshold, opoThreshold, casa]);

  // Separate data for comparison
  const camaraData = useMemo(() => {
    if (casa !== "ambos") return null;
    return computeData(
      allYearsDeputados.map((d) => ({ score: Number(d.score), ano: d.ano })),
      govThreshold, opoThreshold
    );
  }, [allYearsDeputados, govThreshold, opoThreshold, casa]);

  const senadoData = useMemo(() => {
    if (casa !== "ambos") return null;
    return computeData(
      allYearsSenadores.map((s) => ({ score: Number(s.score), ano: s.ano })),
      govThreshold, opoThreshold
    );
  }, [allYearsSenadores, govThreshold, opoThreshold, casa]);

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
            </p>

            {/* Casa filter */}
            <div className="flex gap-2">
              <Button variant={casa === "ambos" ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setCasa("ambos")}>Ambos</Button>
              <Button variant={casa === "camara" ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setCasa("camara")}>Câmara</Button>
              <Button variant={casa === "senado" ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setCasa("senado")}>Senado</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: CLASS_COLORS.Governo }}>
                    Governo ≥
                  </label>
                  <span className="text-sm font-black px-2 py-0.5 rounded-md" style={{ color: CLASS_COLORS.Governo, backgroundColor: `${CLASS_COLORS.Governo}15` }}>
                    {govThreshold}%
                  </span>
                </div>
                <Slider
                  value={[govThreshold]}
                  onValueChange={([v]) => { if (v > opoThreshold + 5) setGovThreshold(v); }}
                  min={10} max={95} step={5}
                />
                <p className="text-[10px] text-muted-foreground">
                  Parlamentares com score ≥ {govThreshold}% são classificados como Governo
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: CLASS_COLORS.Oposição }}>
                    Oposição ≤
                  </label>
                  <span className="text-sm font-black px-2 py-0.5 rounded-md" style={{ color: CLASS_COLORS.Oposição, backgroundColor: `${CLASS_COLORS.Oposição}15` }}>
                    {opoThreshold}%
                  </span>
                </div>
                <Slider
                  value={[opoThreshold]}
                  onValueChange={([v]) => { if (v < govThreshold - 5) setOpoThreshold(v); }}
                  min={5} max={90} step={5}
                />
                <p className="text-[10px] text-muted-foreground">
                  Parlamentares com score ≤ {opoThreshold}% são classificados como Oposição
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Faixas resultantes</p>
              <div className="flex gap-3 text-xs font-semibold flex-wrap">
                <span style={{ color: CLASS_COLORS.Governo }}>Governo: ≥{govThreshold}%</span>
                <span className="text-muted-foreground">•</span>
                <span style={{ color: CLASS_COLORS.Centro }}>Centro: {opoThreshold + 1}%–{govThreshold - 1}%</span>
                <span className="text-muted-foreground">•</span>
                <span style={{ color: CLASS_COLORS.Oposição }}>Oposição: ≤{opoThreshold}%</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Evolução da Composição (% por Ano)
              {casa !== "ambos" && <span className="text-xs text-muted-foreground ml-2">— {casa === "camara" ? "Câmara" : "Senado"}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Bar dataKey="Governo" stackId="a" fill={CLASS_COLORS.Governo} />
                <Bar dataKey="Centro" stackId="a" fill={CLASS_COLORS.Centro} />
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
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={CLASS_COLORS[entry.name] || "#999"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v} parlamentares`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { name: "Governo", pct: latest.Governo, count: latest.govCount },
                { name: "Centro", pct: latest.Centro, count: latest.cenCount },
                { name: "Oposição", pct: latest.Oposição, count: latest.opoCount },
              ].map((item) => (
                <div key={item.name} className="rounded-lg p-2 border" style={{
                  backgroundColor: `${CLASS_COLORS[item.name]}10`,
                  borderColor: `${CLASS_COLORS[item.name]}30`,
                }}>
                  <p className="text-lg font-black" style={{ color: CLASS_COLORS[item.name] }}>{item.pct}%</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.name}</p>
                  <p className="text-xs text-foreground font-semibold">{item.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Câmara vs Senado comparison when "ambos" selected */}
      {casa === "ambos" && camaraData?.latest && senadoData?.latest && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Câmara — {camaraData.latest.ano}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { name: "Governo", pct: camaraData.latest.Governo, count: camaraData.latest.govCount },
                  { name: "Centro", pct: camaraData.latest.Centro, count: camaraData.latest.cenCount },
                  { name: "Oposição", pct: camaraData.latest.Oposição, count: camaraData.latest.opoCount },
                ].map((item) => (
                  <div key={item.name} className="rounded-lg p-2 border" style={{
                    backgroundColor: `${CLASS_COLORS[item.name]}10`,
                    borderColor: `${CLASS_COLORS[item.name]}30`,
                  }}>
                    <p className="text-lg font-black" style={{ color: CLASS_COLORS[item.name] }}>{item.pct}%</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.name}</p>
                    <p className="text-xs text-foreground font-semibold">{item.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Senado — {senadoData.latest.ano}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { name: "Governo", pct: senadoData.latest.Governo, count: senadoData.latest.govCount },
                  { name: "Centro", pct: senadoData.latest.Centro, count: senadoData.latest.cenCount },
                  { name: "Oposição", pct: senadoData.latest.Oposição, count: senadoData.latest.opoCount },
                ].map((item) => (
                  <div key={item.name} className="rounded-lg p-2 border" style={{
                    backgroundColor: `${CLASS_COLORS[item.name]}10`,
                    borderColor: `${CLASS_COLORS[item.name]}30`,
                  }}>
                    <p className="text-lg font-black" style={{ color: CLASS_COLORS[item.name] }}>{item.pct}%</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.name}</p>
                    <p className="text-xs text-foreground font-semibold">{item.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
