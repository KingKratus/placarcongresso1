import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BarChart3, ChevronLeft, ChevronRight, Download, ExternalLink, FileDown, FilePlus2, Filter, Loader2, Search, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ReactMarkdown from "react-markdown";
import { downloadCsv, downloadPdfReport } from "@/lib/exportData";

interface Props { parlamentarId: number; casa: "camara" | "senado"; nome: string; }
interface Emenda {
  id?: string; tipo: string; numero: string; ano: number; proposicao_tipo?: string | null; proposicao_numero?: string | null; proposicao_ano?: number | null;
  ementa?: string | null; situacao?: string | null; valor?: number | null; data_apresentacao?: string | null; url?: string | null;
  tema?: string | null; impacto_estimado?: string | null; area_politica?: string | null; publico_afetado?: string | null; tipo_beneficio?: string | null; resumo_ia?: string | null; confianca?: number | null;
}

const PAGE_SIZE = 12;
const COLORS = ["hsl(var(--primary))", "hsl(var(--governo))", "hsl(var(--oposicao))", "hsl(var(--centro))", "hsl(var(--muted-foreground))", "hsl(45 80% 55%)"];
const impactoScore: Record<string, number> = { Baixo: 35, Médio: 65, Alto: 90 };

export function EmendasTab({ parlamentarId, casa, nome }: Props) {
  const [emendas, setEmendas] = useState<Emenda[]>([]);
  const [source, setSource] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [anoFilter, setAnoFilter] = useState("all");
  const [temaFilter, setTemaFilter] = useState("all");
  const [impactoFilter, setImpactoFilter] = useState("all");
  const [situacaoFilter, setSituacaoFilter] = useState("all");
  const [page, setPage] = useState(0);

  const load = async (force = false) => {
    setLoading(true); setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-emendas", { body: { parlamentar_id: parlamentarId, casa, nome, force } });
      if (error) throw error;
      setEmendas(data?.emendas || []); setSource(data?.source || ""); setNotice(data?.notice || null);
    } catch (e: any) {
      setNotice(e.message || "Falha ao buscar emendas parlamentares.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(false); }, [parlamentarId, casa]);

  const filtered = useMemo(() => emendas.filter((e) => {
    if (anoFilter !== "all" && e.ano !== Number(anoFilter)) return false;
    if (temaFilter !== "all" && (e.tema || "Outros") !== temaFilter) return false;
    if (impactoFilter !== "all" && (e.impacto_estimado || "Médio") !== impactoFilter) return false;
    if (situacaoFilter !== "all" && (e.situacao || "Sem situação") !== situacaoFilter) return false;
    const term = search.trim().toLowerCase();
    if (term && !`${e.tipo} ${e.numero} ${e.ementa || ""} ${e.tema || ""} ${e.resumo_ia || ""} ${e.proposicao_tipo || ""} ${e.proposicao_numero || ""}`.toLowerCase().includes(term)) return false;
    return true;
  }), [emendas, anoFilter, temaFilter, impactoFilter, situacaoFilter, search]);

  useEffect(() => { setPage(0); }, [anoFilter, temaFilter, impactoFilter, situacaoFilter, search]);

  const years = useMemo(() => [...new Set(emendas.map(e => e.ano))].sort((a, b) => b - a), [emendas]);
  const temas = useMemo(() => [...new Set(emendas.map(e => e.tema || "Outros"))].sort(), [emendas]);
  const situacoes = useMemo(() => [...new Set(emendas.map(e => e.situacao || "Sem situação"))].sort(), [emendas]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = useMemo(() => {
    const aprovadas = emendas.filter(e => /aprov|acat|acolh/i.test(e.situacao || "")).length;
    const alto = emendas.filter(e => e.impacto_estimado === "Alto").length;
    const valor = emendas.reduce((s, e) => s + Number(e.valor || 0), 0);
    const confianca = emendas.length ? Math.round(emendas.reduce((s, e) => s + Number(e.confianca || 0), 0) / emendas.length * 100) : 0;
    return { aprovadas, alto, valor, confianca };
  }, [emendas]);

  const chartByTema = useMemo(() => Object.entries(emendas.reduce((m: Record<string, number>, e) => { const k = e.tema || "Outros"; m[k] = (m[k] || 0) + 1; return m; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10), [emendas]);
  const chartByImpacto = useMemo(() => ["Alto", "Médio", "Baixo"].map(name => ({ name, value: emendas.filter(e => (e.impacto_estimado || "Médio") === name).length })), [emendas]);
  const chartByYear = useMemo(() => years.slice().reverse().map(ano => ({ ano, total: emendas.filter(e => e.ano === ano).length, alto: emendas.filter(e => e.ano === ano && e.impacto_estimado === "Alto").length })), [emendas, years]);
  const emendasAvancadas = useMemo(() => filtered.filter((e) => /plen|pauta|vota|aprov|acat|sanc|promulg/i.test(`${e.situacao || ""} ${e.ementa || ""} ${e.resumo_ia || ""}`) || e.impacto_estimado === "Alto"), [filtered]);
  const exportRows = useMemo(() => filtered.map((e) => ({ Tipo: e.tipo, Número: e.numero, Ano: e.ano, Tema: e.tema || "Outros", Impacto: e.impacto_estimado || "Médio", Situação: e.situacao || "Sem situação", Proposição: e.proposicao_tipo ? `${e.proposicao_tipo} ${e.proposicao_numero}/${e.proposicao_ano}` : "", Ementa: e.ementa || "", Insight: e.resumo_ia || "" })), [filtered]);

  const exportCsv = () => downloadCsv(`emendas-${nome}-${casa}.csv`, exportRows);
  const exportPdf = () => downloadPdfReport({
    title: `Resumo das emendas avançadas — ${nome}`,
    subtitle: `${emendasAvancadas.length} emendas priorizadas de ${filtered.length} no recorte atual. Critério: alto impacto, pauta/plenário, votação, aprovação, acatamento ou sanção detectados no texto/situação.`,
    insights: [
      `${stats.aprovadas} emendas aparecem como acatadas/aprovadas e ${stats.alto} foram classificadas como alto impacto pela IA.`,
      `Tema predominante: ${chartByTema[0]?.name || "sem dados"} (${chartByTema[0]?.value || 0} emendas).`,
      `O conjunto filtrado concentra ${emendasAvancadas.length} emendas com sinais de avanço para plenário ou deliberação.`,
      insights ? insights.replace(/[#*_`>-]/g, "").slice(0, 320) : "Gere os insights com IA na tela para incluir uma síntese analítica mais rica no próximo PDF.",
    ],
    charts: [
      { title: "Temas das emendas", data: chartByTema.map((d) => ({ label: d.name, value: d.value })) },
      { title: "Impacto estimado", data: chartByImpacto.map((d) => ({ label: d.name, value: d.value })) },
    ],
    rows: emendasAvancadas.slice(0, 24).map((e) => ({ Emenda: `${e.tipo} ${e.numero}/${e.ano}`, Tema: e.tema || "Outros", Impacto: e.impacto_estimado || "Médio", Situação: e.situacao || "Sem situação", Resumo: e.resumo_ia || e.ementa || "" })),
    filename: `resumo-emendas-avancadas-${nome}-${casa}.pdf`,
  });

  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("insights-emendas", { body: { parlamentar_id: parlamentarId, casa, nome } });
      if (error) throw error;
      setInsights(data?.insights || "Não foi possível gerar insights.");
    } catch (e: any) { setInsights(e.message || "Erro ao gerar insights."); }
    finally { setInsightsLoading(false); }
  };

  if (loading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={18} />Buscando e classificando emendas…</CardContent></Card>;

  return (
    <div className="space-y-4">
      {notice && <Card className="border-primary/20 bg-primary/5"><CardContent className="p-3 text-xs text-muted-foreground">{notice}</CardContent></Card>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-black">{emendas.length}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Emendas</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-black text-governo">{stats.aprovadas}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Acatadas/aprovadas</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-black text-primary">{stats.alto}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Alto impacto</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-black">{stats.confianca}%</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Confiança IA</p></CardContent></Card>
      </div>

      {emendas.length > 0 && <div className="grid lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex gap-2"><BarChart3 size={14}/>Temas das emendas</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><BarChart data={chartByTema} layout="vertical" margin={{ left: 80 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }}/><Tooltip/><Bar dataKey="value" name="Emendas" radius={[0,4,4,0]}>{chartByTema.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Impacto estimado</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><BarChart data={chartByImpacto}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card>
        {chartByYear.length > 1 && <Card className="lg:col-span-3"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Evolução anual</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={230}><LineChart data={chartByYear}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="ano"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2}/><Line dataKey="alto" name="Alto impacto" stroke="hsl(var(--governo))" strokeWidth={2}/></LineChart></ResponsiveContainer></CardContent></Card>}
      </div>}

      <Card><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex gap-2"><Sparkles size={14}/>Insights das emendas</CardTitle><Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={generateInsights} disabled={insightsLoading || emendas.length === 0}>{insightsLoading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} {insights ? "Regenerar" : "Gerar"}</Button></div></CardHeader>{insights && <CardContent><div className="prose prose-sm dark:prose-invert max-w-none text-sm"><ReactMarkdown>{insights}</ReactMarkdown></div></CardContent>}</Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex gap-2"><Filter size={14}/>Filtros e exportação</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2"><div className="relative flex-1 min-w-[170px]"><Search size={14} className="absolute left-3 top-2.5 text-muted-foreground"/><Input className="pl-9 h-9 text-xs" placeholder="Buscar emendas" value={search} onChange={(e) => setSearch(e.target.value)}/></div><Select value={anoFilter} onValueChange={setAnoFilter}><SelectTrigger className="w-24 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Anos</SelectItem>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select><Select value={temaFilter} onValueChange={setTemaFilter}><SelectTrigger className="w-36 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Temas</SelectItem>{temas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={impactoFilter} onValueChange={setImpactoFilter}><SelectTrigger className="w-32 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Impacto</SelectItem><SelectItem value="Alto">Alto</SelectItem><SelectItem value="Médio">Médio</SelectItem><SelectItem value="Baixo">Baixo</SelectItem></SelectContent></Select><Select value={situacaoFilter} onValueChange={setSituacaoFilter}><SelectTrigger className="w-40 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Situação</SelectItem>{situacoes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" className="h-9 text-xs gap-1" onClick={exportCsv} disabled={exportRows.length === 0}><Download size={12}/>CSV</Button><Button size="sm" className="h-9 text-xs gap-1" onClick={exportPdf} disabled={filtered.length === 0}><FileDown size={12}/>PDF</Button><Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => load(true)}>Atualizar</Button></div></CardContent></Card>

      <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex gap-2"><FilePlus2 size={14}/>Emendas ({filtered.length})</CardTitle>{totalPages > 1 && <div className="flex items-center gap-2"><Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14}/></Button><span className="text-xs font-bold text-muted-foreground">{page + 1}/{totalPages}</span><Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14}/></Button></div>}</div></CardHeader><CardContent><div className="space-y-2">{paginated.map((e, i) => <div key={`${e.tipo}-${e.numero}-${e.ano}-${i}`} className="rounded-md border border-border p-3 space-y-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs font-bold"><span className="text-primary">{e.tipo} {e.numero}/{e.ano}</span>{e.proposicao_tipo && <span className="text-muted-foreground"> · {e.proposicao_tipo} {e.proposicao_numero}/{e.proposicao_ano}</span>}</p><p className="text-xs text-foreground line-clamp-2 mt-1">{e.ementa || "Sem ementa disponível"}</p></div><Badge className="border-0 bg-primary/15 text-primary shrink-0">{e.impacto_estimado || "Médio"}</Badge></div><div className="flex items-center gap-2"><Progress value={impactoScore[e.impacto_estimado || "Médio"] || 65} className="h-1.5 flex-1"/><span className="text-[10px] font-bold text-muted-foreground">{Math.round(Number(e.confianca || 0) * 100)}%</span></div><div className="flex flex-wrap gap-1.5 items-center"><Badge variant="secondary" className="text-[9px]">{e.tema || "Outros"}</Badge>{e.situacao && <Badge variant="outline" className="text-[9px]">{e.situacao}</Badge>}{e.area_politica && <Badge variant="outline" className="text-[9px]">{e.area_politica}</Badge>}{e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"><ExternalLink size={10}/>Ver</a>}</div>{e.resumo_ia && <p className="text-[11px] text-muted-foreground">{e.resumo_ia}</p>}</div>)}{filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma emenda encontrada com os filtros.</p>}</div></CardContent></Card>
    </div>
  );
}
