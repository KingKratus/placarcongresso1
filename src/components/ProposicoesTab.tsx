import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, FileText, Sparkles, Loader2, ExternalLink, ChevronLeft, ChevronRight, Filter,
  BarChart3, TrendingUp, GitBranch,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, PieChart, Pie,
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TramitacaoTimeline } from "@/components/TramitacaoTimeline";

const THEME_COLORS: Record<string, string> = {
  "Econômico": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Social": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Segurança": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Educação": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "Saúde": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "Meio Ambiente": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Infraestrutura": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Político-Institucional": "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  "Trabalhista": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "Tributário": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  "Direitos Humanos": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Cultura": "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  "Tecnologia": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "Agropecuária": "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
  "Defesa": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const CHART_COLORS = [
  "hsl(210, 70%, 50%)", "hsl(280, 60%, 55%)", "hsl(0, 70%, 50%)",
  "hsl(40, 80%, 50%)", "hsl(160, 70%, 40%)", "hsl(120, 50%, 40%)",
  "hsl(30, 80%, 50%)", "hsl(215, 20%, 50%)", "hsl(190, 70%, 40%)",
  "hsl(340, 70%, 50%)", "hsl(320, 60%, 55%)", "hsl(260, 60%, 55%)",
  "hsl(230, 70%, 55%)", "hsl(80, 50%, 45%)", "hsl(0, 0%, 50%)",
];

const ITEMS_PER_PAGE = 15;

interface Props {
  parlamentarId: number;
  casa: "camara" | "senado";
  nome: string;
}

interface Proposicao {
  id?: string;
  tipo: string;
  numero: string;
  ano: number;
  ementa: string | null;
  tema: string | null;
  url: string | null;
  data_apresentacao: string | null;
  tipo_autoria?: string | null;
  status_tramitacao?: string | null;
  peso_tipo?: number | null;
}

function normalizeStatus(status?: string | null) {
  const s = (status || "Em tramitação").toLowerCase();
  if (/aprov|sancion|promulg|transform/.test(s)) return "Aprovada";
  if (/arquiv/.test(s)) return "Arquivada";
  if (/rejeit/.test(s)) return "Rejeitada";
  if (/retir/.test(s)) return "Retirada";
  return "Em tramitação";
}

function statusClass(status: string) {
  if (status === "Aprovada") return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (["Arquivada", "Rejeitada", "Retirada"].includes(status)) return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
  return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
}

export function ProposicoesTab({ parlamentarId, casa, nome }: Props) {
  const [proposicoes, setProposicoes] = useState<Proposicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [tramitacaoOpen, setTramitacaoOpen] = useState(false);
  const [tramitacaoTarget, setTramitacaoTarget] = useState<Proposicao | null>(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [anoFilter, setAnoFilter] = useState("all");
  const [temaFilter, setTemaFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-proposicoes`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ parlamentar_id: parlamentarId, casa }),
          }
        );
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        setProposicoes(data.proposicoes || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [parlamentarId, casa]);

  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights-proposicoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ parlamentar_id: parlamentarId, casa, nome }),
        }
      );
      const data = await resp.json();
      setInsights(data.insights || data.error || "Erro ao gerar insights.");
    } catch {
      setInsights("Erro de conexão ao gerar insights.");
    } finally {
      setInsightsLoading(false);
    }
  };

  const availableTipos = useMemo(() => [...new Set(proposicoes.map(p => p.tipo))].sort(), [proposicoes]);
  const availableAnos = useMemo(() => [...new Set(proposicoes.map(p => p.ano))].sort((a, b) => b - a), [proposicoes]);
  const availableTemas = useMemo(() => [...new Set(proposicoes.map(p => p.tema).filter(Boolean))].sort() as string[], [proposicoes]);

  const filtered = useMemo(() => {
    return proposicoes.filter(p => {
      if (tipoFilter !== "all" && p.tipo !== tipoFilter) return false;
      if (anoFilter !== "all" && p.ano !== Number(anoFilter)) return false;
      if (temaFilter !== "all" && p.tema !== temaFilter) return false;
      if (searchText.trim()) {
        const hay = [p.ementa, p.tipo, p.numero, p.tema].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(searchText.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [proposicoes, tipoFilter, anoFilter, temaFilter, searchText]);

  useEffect(() => { setPage(0); }, [tipoFilter, anoFilter, temaFilter, searchText]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  // Stats
  const themeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    proposicoes.forEach(p => { counts[p.tema || "Outros"] = (counts[p.tema || "Outros"] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proposicoes]);

  const typeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    proposicoes.forEach(p => { counts[p.tipo] = (counts[p.tipo] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proposicoes]);

  // Evolution by year chart data
  const yearEvolutionData = useMemo(() => {
    const years = [...new Set(proposicoes.map(p => p.ano))].sort();
    return years.map(ano => {
      const yearProps = proposicoes.filter(p => p.ano === ano);
      return { ano, total: yearProps.length };
    });
  }, [proposicoes]);

  // Theme evolution by year (line chart)
  const themeEvolutionData = useMemo(() => {
    const topThemes = themeStats.slice(0, 6).map(([t]) => t);
    const years = [...new Set(proposicoes.map(p => p.ano))].sort();
    return years.map(ano => {
      const entry: Record<string, any> = { ano };
      topThemes.forEach(tema => {
        entry[tema] = proposicoes.filter(p => p.ano === ano && (p.tema || "Outros") === tema).length;
      });
      return entry;
    });
  }, [proposicoes, themeStats]);

  const topThemeNames = useMemo(() => themeStats.slice(0, 6).map(([t]) => t), [themeStats]);

  // Type by year stacked bar
  const typeByYearData = useMemo(() => {
    const years = [...new Set(proposicoes.map(p => p.ano))].sort();
    const topTypes = typeStats.slice(0, 6).map(([t]) => t);
    return years.map(ano => {
      const entry: Record<string, any> = { ano };
      topTypes.forEach(tipo => {
        entry[tipo] = proposicoes.filter(p => p.ano === ano && p.tipo === tipo).length;
      });
      return entry;
    });
  }, [proposicoes, typeStats]);

  const topTypeNames = useMemo(() => typeStats.slice(0, 6).map(([t]) => t), [typeStats]);

  const advancedInsights = useMemo(() => {
    const withStatus = proposicoes.map((p) => ({ ...p, normalizedStatus: normalizeStatus(p.status_tramitacao), peso: Number(p.peso_tipo || 0.3) }));
    const statusData = ["Em tramitação", "Aprovada", "Arquivada", "Rejeitada", "Retirada"].map((name) => ({ name, value: withStatus.filter((p) => p.normalizedStatus === name).length })).filter((d) => d.value > 0);
    const autoriaData = ["autor", "coautor"].map((name) => ({ name: name === "coautor" ? "Coautor" : "Autor", value: withStatus.filter((p) => (p.tipo_autoria || "autor") === name).length }));
    const aprovadas = withStatus.filter((p) => p.normalizedStatus === "Aprovada").length;
    const ativas = withStatus.filter((p) => p.normalizedStatus === "Em tramitação").length;
    const taxaAprovacao = proposicoes.length ? Math.round((aprovadas / proposicoes.length) * 100) : 0;
    const taxaAvanco = proposicoes.length ? Math.round(((aprovadas + ativas) / proposicoes.length) * 100) : 0;
    const ranking = [...withStatus]
      .map((p) => ({ ...p, relevancia: Math.round((p.peso * 70) + (p.normalizedStatus === "Aprovada" ? 30 : p.normalizedStatus === "Em tramitação" ? 18 : 4)) }))
      .sort((a, b) => b.relevancia - a.relevancia || b.ano - a.ano)
      .slice(0, 8);
    const temaStatus = themeStats.slice(0, 8).map(([tema]) => ({
      tema,
      aprovadas: withStatus.filter((p) => (p.tema || "Outros") === tema && p.normalizedStatus === "Aprovada").length,
      tramitação: withStatus.filter((p) => (p.tema || "Outros") === tema && p.normalizedStatus === "Em tramitação").length,
      encerradas: withStatus.filter((p) => (p.tema || "Outros") === tema && !["Aprovada", "Em tramitação"].includes(p.normalizedStatus)).length,
    }));
    const yearStatus = availableAnos.slice().reverse().map((ano) => ({
      ano,
      total: withStatus.filter((p) => p.ano === ano).length,
      aprovadas: withStatus.filter((p) => p.ano === ano && p.normalizedStatus === "Aprovada").length,
      tramitação: withStatus.filter((p) => p.ano === ano && p.normalizedStatus === "Em tramitação").length,
    }));
    return { statusData, autoriaData, taxaAprovacao, taxaAvanco, ranking, temaStatus, yearStatus };
  }, [proposicoes, themeStats, availableAnos]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin mr-2" size={20} />
          <span className="text-sm text-muted-foreground">Buscando proposições legislativas...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">Erro: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (proposicoes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="mx-auto mb-2 text-muted-foreground" size={32} />
          <p className="text-sm text-muted-foreground">Nenhuma proposição legislativa encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black">{proposicoes.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black">{availableTipos.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Tipos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black">{availableTemas.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Temas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black">{availableAnos.length}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Anos</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Leitura executiva das proposições</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p className="text-2xl font-black text-primary">{advancedInsights.taxaAvanco}%</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Ativas/aprovadas</p></div>
            <div><p className="text-2xl font-black text-governo">{advancedInsights.taxaAprovacao}%</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Taxa aprovada</p></div>
            <div><p className="text-2xl font-black">{advancedInsights.statusData.find((d) => d.name === "Em tramitação")?.value || 0}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Em tramitação</p></div>
            <div><p className="text-2xl font-black">{advancedInsights.ranking[0]?.tipo || "—"}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Tipo mais relevante</p></div>
          </div>
          <div className="space-y-1"><div className="flex items-center justify-between text-xs"><span className="font-bold text-muted-foreground uppercase">Progresso do portfólio legislativo</span><span className="font-black">{advancedInsights.taxaAvanco}%</span></div><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${advancedInsights.taxaAvanco}%` }} /></div></div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status das proposições</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={230}><BarChart data={advancedInsights.statusData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name" tick={{ fontSize: 10 }}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" name="Qtd" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Autoria</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={advancedInsights.autoriaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} label>{advancedInsights.autoriaData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top relevância</CardTitle></CardHeader><CardContent><div className="space-y-2">{advancedInsights.ranking.slice(0, 5).map((p, i) => { const st = normalizeStatus(p.status_tramitacao); return <div key={`${p.tipo}-${p.numero}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-border p-2"><div className="min-w-0"><p className="text-xs font-bold truncate">{p.tipo} {p.numero}/{p.ano}</p><p className="text-[10px] text-muted-foreground truncate">{p.tema || "Outros"}</p></div><Badge className={`border-0 text-[9px] ${statusClass(st)}`}>{st}</Badge></div>; })}</div></CardContent></Card>
      </div>

      {advancedInsights.yearStatus.length > 1 && <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Evolução por status</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><LineChart data={advancedInsights.yearStatus}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="ano"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2}/><Line dataKey="aprovadas" name="Aprovadas" stroke="hsl(var(--governo))" strokeWidth={2}/><Line dataKey="tramitação" name="Em tramitação" stroke="hsl(var(--centro))" strokeWidth={2}/></LineChart></ResponsiveContainer></CardContent></Card>}

      {advancedInsights.temaStatus.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Temas por status</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={260}><BarChart data={advancedInsights.temaStatus} margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="tema" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 10 }}/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="aprovadas" stackId="a" name="Aprovadas" fill="hsl(var(--governo))"/><Bar dataKey="tramitação" stackId="a" name="Em tramitação" fill="hsl(var(--centro))"/><Bar dataKey="encerradas" stackId="a" name="Encerradas" fill="hsl(var(--oposicao))"/></BarChart></ResponsiveContainer></CardContent></Card>}

      {/* Evolution Charts */}
      {yearEvolutionData.length > 1 && (
        <div className="grid md:grid-cols-2 gap-3">
          {/* Propositions by year */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <TrendingUp size={14} /> Evolução por Ano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={yearEvolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="total" name="Proposições" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Theme evolution (line chart) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <BarChart3 size={14} /> Temas por Ano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={themeEvolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  {topThemeNames.map((tema, i) => (
                    <Line
                      key={tema}
                      type="monotone"
                      dataKey={tema}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Type by Year stacked bar */}
      {typeByYearData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText size={14} /> Tipos por Ano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeByYearData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                {topTypeNames.map((tipo, i) => (
                  <Bar
                    key={tipo}
                    dataKey={tipo}
                    stackId="a"
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={i === topTypeNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Theme and Type distribution */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <BarChart3 size={14} /> Temas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {themeStats.slice(0, 8).map(([tema, count]) => (
                <div key={tema} className="flex items-center gap-2">
                  <Badge className={`text-[9px] px-1.5 py-0 border-0 shrink-0 ${THEME_COLORS[tema] || "bg-muted text-muted-foreground"}`}>
                    {tema}
                  </Badge>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(count / proposicoes.length) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText size={14} /> Tipos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {typeStats.map(([tipo, count]) => (
                <Badge key={tipo} variant="outline" className="text-xs font-bold">
                  {tipo}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Sparkles size={14} /> Insights com IA
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={generateInsights} disabled={insightsLoading}>
              {insightsLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {insights ? "Regenerar" : "Gerar Insights"}
            </Button>
          </div>
        </CardHeader>
        {insights && (
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Filter size={14} /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
              <Input placeholder="Buscar ementa..." className="pl-9 h-9 text-xs" value={searchText} onChange={e => setSearchText(e.target.value)} />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-24 h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableTipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={anoFilter} onValueChange={setAnoFilter}>
              <SelectTrigger className="w-24 h-9 text-xs"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableAnos.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {availableTemas.length > 0 && (
              <Select value={temaFilter} onValueChange={setTemaFilter}>
                <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Tema" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableTemas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText size={14} /> Proposições ({filtered.length})
            </CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-bold text-muted-foreground">{page + 1}/{totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {paginated.map((p, i) => (
              <div key={`${p.tipo}-${p.numero}-${p.ano}-${i}`} className="p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2">
                      <span className="font-black text-primary mr-1">{p.tipo} {p.numero}/{p.ano}</span>
                      {p.ementa || "Sem ementa disponível"}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.tipo_autoria && (
                        <Badge
                          className={`text-[8px] px-1.5 py-0 border-0 font-black uppercase tracking-wider ${
                            p.tipo_autoria === "coautor"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {p.tipo_autoria === "coautor" ? "Co-autor" : "Autor"}
                        </Badge>
                      )}
                      {p.tema && (
                        <Badge className={`text-[8px] px-1.5 py-0 border-0 ${THEME_COLORS[p.tema] || "bg-muted text-muted-foreground"}`}>
                          {p.tema}
                        </Badge>
                      )}
                      {p.data_apresentacao && (
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(p.data_apresentacao).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-primary hover:underline flex items-center gap-0.5">
                          <ExternalLink size={9} /> Ver
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => { setTramitacaoTarget(p); setTramitacaoOpen(true); }}
                        className="text-[9px] font-bold text-primary hover:underline flex items-center gap-0.5"
                      >
                        <GitBranch size={9} /> Tramitação
                      </button>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0">{p.tipo}</Badge>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma proposição encontrada com os filtros.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tramitação Sheet */}
      <Sheet open={tramitacaoOpen} onOpenChange={setTramitacaoOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base flex items-center gap-2">
              <GitBranch size={16} />
              Tramitação Legislativa
            </SheetTitle>
          </SheetHeader>
          {tramitacaoTarget && (
            <TramitacaoTimeline
              casa={casa}
              tipo={tramitacaoTarget.tipo}
              numero={tramitacaoTarget.numero}
              ano={tramitacaoTarget.ano}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
