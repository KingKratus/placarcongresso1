import { useMemo, useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  History,
  Minus,
  Sparkles,
  Tag,
  Brain,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SankeyMigration } from "@/components/insights/SankeyMigration";
import { useVotacaoTemas } from "@/hooks/useVotacaoTemas";

type Analise = Tables<"analises_senadores">;

interface CentroTrendsSenadoProps {
  analises: Analise[];
  ano: number;
  onSenadorClick?: (id: number) => void;
}

const CENTRO_MIN = 35;
const CENTRO_MAX = 70;
const CENTRO_MID = (CENTRO_MIN + CENTRO_MAX) / 2;

function getTendency(score: number, mode: "tradicional" | "ia" = "tradicional"): "governo" | "oposicao" | "neutro" {
  const margin = mode === "ia" ? 1.5 : 3;
  if (score >= CENTRO_MID + margin) return "governo";
  if (score <= CENTRO_MID - margin) return "oposicao";
  return "neutro";
}

function getTendencyLabel(t: "governo" | "oposicao" | "neutro") {
  if (t === "governo") return "→ Governo";
  if (t === "oposicao") return "→ Oposição";
  return "Neutro";
}

type Migration = {
  senador_id: number;
  nome: string;
  partido: string | null;
  foto: string | null;
  scorePrev: number;
  scoreCurr: number;
  classPrev: string;
  classCurr: string;
  delta: number;
  direction: "governo" | "oposicao" | "stable";
};

export function CentroTrendsSenado({ analises, ano, onSenadorClick }: CentroTrendsSenadoProps) {
  const [compareYear, setCompareYear] = useState<number>(ano - 1);
  const [prevAnalises, setPrevAnalises] = useState<Analise[]>([]);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [temaFilter, setTemaFilter] = useState("all");
  const [weightMode, setWeightMode] = useState<"tradicional" | "ia">("tradicional");
  const { temasAtivos, classifying, classify, temas: temasData } = useVotacaoTemas(ano, "senado");
  const fetchPrevYear = useCallback(async (y: number) => {
    setLoadingPrev(true);
    const { data } = await supabase
      .from("analises_senadores")
      .select("*")
      .eq("ano", y)
      .order("score", { ascending: false });
    setPrevAnalises(data || []);
    setLoadingPrev(false);
  }, []);

  useEffect(() => {
    if (compareYear !== ano) fetchPrevYear(compareYear);
  }, [compareYear, ano, fetchPrevYear]);

  const centroSenadores = useMemo(
    () => analises.filter((a) => a.classificacao === "Centro").sort((a, b) => Number(b.score) - Number(a.score)),
    [analises]
  );

  const { leanGov, leanOpo, neutro, chartData, avgScore } = useMemo(() => {
    const lg = centroSenadores.filter((s) => getTendency(Number(s.score), weightMode) === "governo");
    const lo = centroSenadores.filter((s) => getTendency(Number(s.score), weightMode) === "oposicao");
    const n = centroSenadores.filter((s) => getTendency(Number(s.score), weightMode) === "neutro");
    const avg = centroSenadores.length > 0
      ? centroSenadores.reduce((sum, s) => sum + Number(s.score), 0) / centroSenadores.length
      : 0;
    const chart = centroSenadores.map((s) => ({
      name: s.senador_nome.split(" ").slice(0, 2).join(" "),
      fullName: s.senador_nome,
      score: Number(s.score),
      partido: s.senador_partido,
      id: s.senador_id,
      tendency: getTendency(Number(s.score), weightMode),
    }));
    return { leanGov: lg, leanOpo: lo, neutro: n, chartData: chart, avgScore: avg };
  }, [centroSenadores, weightMode]);

  // Alertas: maiores migrações com delta > 20pp
  const alertasMigracao = useMemo<Migration[]>(() => [], []);

  // Year-over-year migrations
  const migrations = useMemo<Migration[]>(() => {
    if (prevAnalises.length === 0) return [];
    const prevMap = new Map(prevAnalises.map((a) => [a.senador_id, a]));
    const results: Migration[] = [];

    for (const curr of analises) {
      const prev = prevMap.get(curr.senador_id);
      if (!prev) continue;
      // Skip senators with very few votes in either year (unreliable scores)
      if (Number(curr.total_votos) < 5 || Number(prev.total_votos) < 5) continue;
      const scoreCurr = Number(curr.score);
      const scorePrev = Number(prev.score);
      const delta = scoreCurr - scorePrev;
      if (Math.abs(delta) < 3) continue;

      results.push({
        senador_id: curr.senador_id,
        nome: curr.senador_nome,
        partido: curr.senador_partido,
        foto: curr.senador_foto,
        scorePrev,
        scoreCurr,
        classPrev: prev.classificacao,
        classCurr: curr.classificacao,
        delta: Math.round(delta * 100) / 100,
        direction: delta > 0 ? "governo" : "oposicao",
      });
    }

    return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [analises, prevAnalises]);

  const classChanges = useMemo(() => {
    return migrations.filter((m) => m.classPrev !== m.classCurr);
  }, [migrations]);

  // Sankey flow data
  const sankeyFlows = useMemo(() => {
    if (prevAnalises.length === 0) return [];
    const prevMap = new Map(prevAnalises.map((a) => [a.senador_id, a]));
    const flowMap: Record<string, number> = {};
    for (const curr of analises) {
      const prev = prevMap.get(curr.senador_id);
      if (!prev) continue;
      const key = `${prev.classificacao}→${curr.classificacao}`;
      flowMap[key] = (flowMap[key] || 0) + 1;
    }
    return Object.entries(flowMap).map(([key, count]) => {
      const [from, to] = key.split("→");
      return { from, to, count };
    });
  }, [analises, prevAnalises]);

  if (centroSenadores.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Target size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">
            Nenhum senador classificado como Centro
          </p>
        </CardContent>
      </Card>
    );
  }

  const govPct = Math.round((leanGov.length / centroSenadores.length) * 100);
  const opoPct = Math.round((leanOpo.length / centroSenadores.length) * 100);
  const neuPct = Math.round((neutro.length / centroSenadores.length) * 100);

  return (
    <div className="space-y-4">
      {/* Theme filter */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Tag size={14} className="text-primary shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">Tema:</span>
          <Select value={temaFilter} onValueChange={setTemaFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Todos os temas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os temas</SelectItem>
              {temasAtivos.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="sm"
            className="h-8 text-xs gap-1"
            onClick={classify}
            disabled={classifying}
          >
            <Sparkles size={12} className={classifying ? "animate-spin" : ""} />
            {classifying ? "Classificando..." : temasAtivos.length > 0 ? "Reclassificar" : "Classificar com IA"}
          </Button>
          {temasAtivos.length > 0 && (
            <span className="text-[9px] text-muted-foreground">{temasData.length} votações classificadas</span>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-governo/30 bg-governo/5">
          <CardContent className="p-4 text-center">
            <TrendingUp size={18} className="mx-auto text-governo mb-1" />
            <p className="text-2xl font-black text-foreground">{leanGov.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Tendência Governo
            </p>
            <Badge className="bg-governo text-governo-foreground mt-1 text-[10px]">{govPct}%</Badge>
          </CardContent>
        </Card>
        <Card className="border-centro/30 bg-centro/5">
          <CardContent className="p-4 text-center">
            <ArrowRight size={18} className="mx-auto text-centro mb-1" />
            <p className="text-2xl font-black text-foreground">{neutro.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Neutro
            </p>
            <Badge className="bg-centro text-centro-foreground mt-1 text-[10px]">{neuPct}%</Badge>
          </CardContent>
        </Card>
        <Card className="border-oposicao/30 bg-oposicao/5">
          <CardContent className="p-4 text-center">
            <TrendingDown size={18} className="mx-auto text-oposicao mb-1" />
            <p className="text-2xl font-black text-foreground">{leanOpo.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Tendência Oposição
            </p>
            <Badge className="bg-oposicao text-oposicao-foreground mt-1 text-[10px]">{opoPct}%</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tendency bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Target size={14} />
            Barra de Tendência do Centro
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
            Média do Centro:{" "}
            <span className="font-black text-foreground">{avgScore.toFixed(1)}%</span>
            {avgScore > CENTRO_MID + 2 && <span className="text-governo ml-1">— inclinação pró-governo</span>}
            {avgScore < CENTRO_MID - 2 && <span className="text-oposicao ml-1">— inclinação pró-oposição</span>}
            {avgScore >= CENTRO_MID - 2 && avgScore <= CENTRO_MID + 2 && <span className="text-centro ml-1">— equilibrado</span>}
          </p>
        </CardContent>
      </Card>

      {/* Year-over-year comparison */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <History size={14} />
              Migração entre Anos
            </CardTitle>
            <Select value={String(compareYear)} onValueChange={(v) => setCompareYear(Number(v))}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].filter((y) => y !== ano).map((y) => (
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
            <p className="text-sm text-muted-foreground text-center py-6">
              Sem dados para {compareYear}. Sincronize esse ano primeiro.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Sankey diagram */}
              {sankeyFlows.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                    Fluxo de Migração
                  </p>
                  <SankeyMigration flows={sankeyFlows} yearFrom={compareYear} yearTo={ano} casa="senado" />
                </div>
              )}

              {/* Class changes highlight */}
              {classChanges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Mudaram de classificação ({classChanges.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {classChanges.map((m) => (
                      <button
                        key={m.senador_id}
                        onClick={() => onSenadorClick?.(m.senador_id)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                      >
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

              {/* All significant movements */}
              {migrations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Maiores movimentações ({migrations.length})
                  </p>
                  <ScrollArea className="max-h-[40vh]">
                    <div className="space-y-1">
                      {migrations.slice(0, 30).map((m) => (
                        <button
                          key={m.senador_id}
                          onClick={() => onSenadorClick?.(m.senador_id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                        >
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

      {/* Distribution chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Distribuição dos Scores no Centro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" domain={[CENTRO_MIN, CENTRO_MAX]} ticks={[35, 45, 52.5, 60, 70]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fontWeight: 600 }} />
              <ReferenceLine
                x={CENTRO_MID}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{ value: "Ponto médio", position: "top", style: { fontSize: 9, fill: "hsl(var(--muted-foreground))" } }}
              />
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
              <Bar dataKey="score" radius={[0, 4, 4, 0]} onClick={(data) => onSenadorClick?.(data.id)} className="cursor-pointer">
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.tendency === "governo" ? "hsl(var(--governo))" : entry.tendency === "oposicao" ? "hsl(var(--oposicao))" : "hsl(var(--centro))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TendencyList
          title="Tendência Governo"
          icon={<TrendingUp size={14} className="text-governo" />}
          senadores={leanGov}
          accentClass="governo"
          onSenadorClick={onSenadorClick}
        />
        <TendencyList
          title="Tendência Oposição"
          icon={<TrendingDown size={14} className="text-oposicao" />}
          senadores={leanOpo}
          accentClass="oposicao"
          onSenadorClick={onSenadorClick}
        />
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

function TendencyList({
  title, icon, senadores, accentClass, onSenadorClick,
}: {
  title: string; icon: React.ReactNode; senadores: Analise[]; accentClass: string; onSenadorClick?: (id: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {title}
          <Badge variant="secondary" className="ml-auto text-[10px]">{senadores.length} sen.</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[40vh]">
          <div className="px-4 pb-4 space-y-2">
            {senadores.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum senador nesta tendência</p>
            )}
            {senadores.map((sen) => {
              const score = Number(sen.score);
              const normalized = ((score - CENTRO_MIN) / (CENTRO_MAX - CENTRO_MIN)) * 100;
              return (
                <button
                  key={sen.senador_id}
                  onClick={() => onSenadorClick?.(sen.senador_id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  {sen.senador_foto && <img src={sen.senador_foto} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{sen.senador_nome}</span>
                      <Badge variant="outline" className="text-[8px] flex-shrink-0">{sen.senador_partido}</Badge>
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
