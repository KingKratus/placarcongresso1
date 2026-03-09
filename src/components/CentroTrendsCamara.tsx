import { useMemo, useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, ArrowRight, ArrowUpRight, ArrowDownRight, Target, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface Props {
  analises: Analise[];
  ano: number;
  onDeputadoClick?: (id: number) => void;
}

const CENTRO_MIN = 35;
const CENTRO_MAX = 70;
const CENTRO_MID = (CENTRO_MIN + CENTRO_MAX) / 2;

function getTendency(score: number): "governo" | "oposicao" | "neutro" {
  if (score >= CENTRO_MID + 3) return "governo";
  if (score <= CENTRO_MID - 3) return "oposicao";
  return "neutro";
}

function getTendencyLabel(t: "governo" | "oposicao" | "neutro") {
  if (t === "governo") return "→ Governo";
  if (t === "oposicao") return "→ Oposição";
  return "Neutro";
}

type Migration = {
  id: number; nome: string; partido: string | null; foto: string | null;
  scorePrev: number; scoreCurr: number; classPrev: string; classCurr: string;
  delta: number; direction: "governo" | "oposicao" | "stable";
};

export function CentroTrendsCamara({ analises, ano, onDeputadoClick }: Props) {
  const [compareYear, setCompareYear] = useState<number>(ano - 1);
  const [prevAnalises, setPrevAnalises] = useState<Analise[]>([]);
  const [loadingPrev, setLoadingPrev] = useState(false);

  const fetchPrevYear = useCallback(async (y: number) => {
    setLoadingPrev(true);
    const { data } = await supabase
      .from("analises_deputados").select("*").eq("ano", y).order("score", { ascending: false }).limit(2000);
    setPrevAnalises(data || []);
    setLoadingPrev(false);
  }, []);

  useEffect(() => {
    if (compareYear !== ano) fetchPrevYear(compareYear);
  }, [compareYear, ano, fetchPrevYear]);

  const centroDeputados = useMemo(
    () => analises.filter((a) => a.classificacao === "Centro").sort((a, b) => Number(b.score) - Number(a.score)),
    [analises]
  );

  const { leanGov, leanOpo, neutro, chartData, avgScore } = useMemo(() => {
    const lg = centroDeputados.filter((d) => getTendency(Number(d.score)) === "governo");
    const lo = centroDeputados.filter((d) => getTendency(Number(d.score)) === "oposicao");
    const n = centroDeputados.filter((d) => getTendency(Number(d.score)) === "neutro");
    const avg = centroDeputados.length > 0
      ? centroDeputados.reduce((sum, d) => sum + Number(d.score), 0) / centroDeputados.length : 0;
    const chart = centroDeputados.map((d) => ({
      name: d.deputado_nome.split(" ").slice(0, 2).join(" "),
      fullName: d.deputado_nome,
      score: Number(d.score),
      partido: d.deputado_partido,
      id: d.deputado_id,
      tendency: getTendency(Number(d.score)),
    }));
    return { leanGov: lg, leanOpo: lo, neutro: n, chartData: chart, avgScore: avg };
  }, [centroDeputados]);

  const migrations = useMemo<Migration[]>(() => {
    if (prevAnalises.length === 0) return [];
    const prevMap = new Map(prevAnalises.map((a) => [a.deputado_id, a]));
    const results: Migration[] = [];
    for (const curr of analises) {
      const prev = prevMap.get(curr.deputado_id);
      if (!prev) continue;
      const delta = Number(curr.score) - Number(prev.score);
      if (Math.abs(delta) < 3) continue;
      results.push({
        id: curr.deputado_id, nome: curr.deputado_nome, partido: curr.deputado_partido,
        foto: curr.deputado_foto, scorePrev: Number(prev.score), scoreCurr: Number(curr.score),
        classPrev: prev.classificacao, classCurr: curr.classificacao,
        delta: Math.round(delta * 100) / 100, direction: delta > 0 ? "governo" : "oposicao",
      });
    }
    return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [analises, prevAnalises]);

  const classChanges = useMemo(() => migrations.filter((m) => m.classPrev !== m.classCurr), [migrations]);

  if (centroDeputados.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Target size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Nenhum deputado classificado como Centro</p>
        </CardContent>
      </Card>
    );
  }

  const govPct = Math.round((leanGov.length / centroDeputados.length) * 100);
  const opoPct = Math.round((leanOpo.length / centroDeputados.length) * 100);
  const neuPct = Math.round((neutro.length / centroDeputados.length) * 100);

  const availableYears = [2023, 2024, 2025, 2026].filter((y) => y !== ano);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-governo/30 bg-governo/5">
          <CardContent className="p-4 text-center">
            <TrendingUp size={18} className="mx-auto text-governo mb-1" />
            <p className="text-2xl font-black text-foreground">{leanGov.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tendência Governo</p>
            <Badge className="bg-governo text-governo-foreground mt-1 text-[10px]">{govPct}%</Badge>
          </CardContent>
        </Card>
        <Card className="border-centro/30 bg-centro/5">
          <CardContent className="p-4 text-center">
            <ArrowRight size={18} className="mx-auto text-centro mb-1" />
            <p className="text-2xl font-black text-foreground">{neutro.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Neutro</p>
            <Badge className="bg-centro text-centro-foreground mt-1 text-[10px]">{neuPct}%</Badge>
          </CardContent>
        </Card>
        <Card className="border-oposicao/30 bg-oposicao/5">
          <CardContent className="p-4 text-center">
            <TrendingDown size={18} className="mx-auto text-oposicao mb-1" />
            <p className="text-2xl font-black text-foreground">{leanOpo.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tendência Oposição</p>
            <Badge className="bg-oposicao text-oposicao-foreground mt-1 text-[10px]">{opoPct}%</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tendency bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Target size={14} /> Barra de Tendência do Centro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="text-oposicao">Oposição</span>
            <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-muted">
              <div className="bg-oposicao/70 transition-all" style={{ width: `${opoPct}%` }} />
              <div className="bg-centro/70 transition-all" style={{ width: `${neuPct}%` }} />
              <div className="bg-governo/70 transition-all" style={{ width: `${govPct}%` }} />
            </div>
            <span className="text-governo">Governo</span>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Média do Centro: <span className="font-black text-foreground">{avgScore.toFixed(1)}%</span>
            {avgScore > CENTRO_MID + 2 && <span className="text-governo ml-1">— inclinação pró-governo</span>}
            {avgScore < CENTRO_MID - 2 && <span className="text-oposicao ml-1">— inclinação pró-oposição</span>}
            {avgScore >= CENTRO_MID - 2 && avgScore <= CENTRO_MID + 2 && <span className="text-centro ml-1">— equilibrado</span>}
          </p>
        </CardContent>
      </Card>

      {/* Year-over-year */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <History size={14} /> Migração entre Anos
            </CardTitle>
            <Select value={String(compareYear)} onValueChange={(v) => setCompareYear(Number(v))}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs">{y} → {ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPrev ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando dados de {compareYear}...</p>
          ) : prevAnalises.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem dados para {compareYear}.</p>
          ) : (
            <div className="space-y-4">
              {classChanges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Mudaram de classificação ({classChanges.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {classChanges.slice(0, 20).map((m) => (
                      <button key={m.id} onClick={() => onDeputadoClick?.(m.id)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left">
                        {m.foto && <img src={m.foto} alt="" className="w-8 h-8 rounded-full object-cover" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground truncate">{m.nome}</span>
                            <Badge variant="outline" className="text-[8px]">{m.partido}</Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-[10px]">
                            <ClassBadge cls={m.classPrev} />
                            <ArrowRight size={10} className="text-muted-foreground" />
                            <ClassBadge cls={m.classCurr} />
                            <span className={`ml-1 font-black ${m.delta > 0 ? "text-governo" : "text-oposicao"}`}>
                              {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}pp
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {migrations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Maiores movimentações ({migrations.length})
                  </p>
                  <ScrollArea className="max-h-[40vh]">
                    <div className="space-y-1">
                      {migrations.slice(0, 30).map((m) => (
                        <button key={m.id} onClick={() => onDeputadoClick?.(m.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left">
                          {m.foto && <img src={m.foto} alt="" className="w-7 h-7 rounded-full object-cover" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-foreground truncate">{m.nome}</span>
                              <Badge variant="outline" className="text-[8px]">{m.partido}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground">{m.scorePrev.toFixed(0)}%</span>
                            <ArrowRight size={10} className="text-muted-foreground" />
                            <span className="text-[10px] font-bold text-foreground">{m.scoreCurr.toFixed(0)}%</span>
                            <span className={`text-[10px] font-black flex items-center gap-0.5 ${m.delta > 0 ? "text-governo" : "text-oposicao"}`}>
                              {m.delta > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                              {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {migrations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma movimentação significativa (&gt;3pp) entre {compareYear} e {ano}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution chart - top 30 only to avoid overflow */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Distribuição dos Scores no Centro (Top 30)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(280, Math.min(chartData.length, 30) * 28)}>
            <BarChart data={chartData.slice(0, 30)} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" domain={[CENTRO_MIN, CENTRO_MAX]} ticks={[35, 45, 52.5, 60, 70]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fontWeight: 600 }} />
              <ReferenceLine x={CENTRO_MID} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
                label={{ value: "Ponto médio", position: "top", style: { fontSize: 9, fill: "hsl(var(--muted-foreground))" } }} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                      <p className="font-black">{d.fullName}</p>
                      <p className="text-muted-foreground">{d.partido}</p>
                      <p className="font-bold mt-1">
                        Score: {d.score.toFixed(1)}% —{" "}
                        <span className={d.tendency === "governo" ? "text-governo" : d.tendency === "oposicao" ? "text-oposicao" : "text-centro"}>
                          {getTendencyLabel(d.tendency)}
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} onClick={(data) => onDeputadoClick?.(data.id)} className="cursor-pointer">
                {chartData.slice(0, 30).map((entry, i) => (
                  <Cell key={i} fill={entry.tendency === "governo" ? "hsl(var(--governo))" : entry.tendency === "oposicao" ? "hsl(var(--oposicao))" : "hsl(var(--centro))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TendencyList title="Tendência Governo" icon={<TrendingUp size={14} className="text-governo" />}
          deputados={leanGov} accentClass="governo" onClick={onDeputadoClick} />
        <TendencyList title="Tendência Oposição" icon={<TrendingDown size={14} className="text-oposicao" />}
          deputados={leanOpo} accentClass="oposicao" onClick={onDeputadoClick} />
      </div>
    </div>
  );
}

function ClassBadge({ cls }: { cls: string }) {
  const colors: Record<string, string> = {
    Governo: "bg-governo text-governo-foreground",
    Centro: "bg-centro text-centro-foreground",
    Oposição: "bg-oposicao text-oposicao-foreground",
    "Sem Dados": "bg-muted text-muted-foreground",
  };
  return <Badge className={`${colors[cls] || "bg-muted text-muted-foreground"} text-[8px] px-1.5 py-0`}>{cls}</Badge>;
}

function TendencyList({ title, icon, deputados, accentClass, onClick }: {
  title: string; icon: React.ReactNode; deputados: Analise[]; accentClass: string; onClick?: (id: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {title}
          <Badge variant="secondary" className="ml-auto text-[10px]">{deputados.length} dep.</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[40vh]">
          <div className="px-4 pb-4 space-y-2">
            {deputados.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum deputado nesta tendência</p>
            )}
            {deputados.map((dep) => {
              const score = Number(dep.score);
              const normalized = ((score - CENTRO_MIN) / (CENTRO_MAX - CENTRO_MIN)) * 100;
              return (
                <button key={dep.deputado_id} onClick={() => onClick?.(dep.deputado_id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left">
                  {dep.deputado_foto && <img src={dep.deputado_foto} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{dep.deputado_nome}</span>
                      <Badge variant="outline" className="text-[8px] flex-shrink-0">{dep.deputado_partido}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={normalized} className="h-1.5 flex-1" />
                      <span className={`text-[10px] font-black text-${accentClass} flex-shrink-0`}>{score.toFixed(1)}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
