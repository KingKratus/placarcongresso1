import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Download, FileDown, Loader2, RefreshCcw, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { downloadCsv, downloadPdfReport } from "@/lib/exportData";

interface EmendaOrcamentaria {
  id: string;
  codigo_emenda: string;
  ano: number;
  tipo_emenda: string;
  numero_emenda: string | null;
  autor: string | null;
  nome_autor: string | null;
  partido: string | null;
  uf: string | null;
  localidade_gasto: string | null;
  funcao: string | null;
  subfuncao: string | null;
  valor_empenhado: number;
  valor_liquidado: number;
  valor_pago: number;
  valor_resto_pago: number;
  valor_resto_cancelado: number;
  tema_ia: string;
  subtema_ia: string | null;
  area_publica: string | null;
  publico_beneficiado: string | null;
  risco_execucao: "Baixo" | "Médio" | "Alto";
  estagio_execucao: string;
  resumo_ia: string | null;
  confianca_ia: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--governo))", "hsl(var(--oposicao))", "hsl(var(--centro))", "hsl(var(--muted-foreground))", "hsl(45 80% 55%)", "hsl(190 70% 42%)"];
const PAGE_SIZE = 25;
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2021 }, (_, i) => currentYear - i);
const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n || 0));
const pct = (pago: number, empenhado: number) => (empenhado > 0 ? Math.min(100, Math.round((pago / empenhado) * 100)) : 0);
const compact = (n: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n || 0));

function groupSum(rows: EmendaOrcamentaria[], key: keyof EmendaOrcamentaria, valueKey: keyof EmendaOrcamentaria = "valor_pago", limit = 10) {
  const map: Record<string, { total: number; empenhado: number; count: number }> = {};
  rows.forEach((r) => {
    const k = String(r[key] || "Não informado");
    map[k] = map[k] || { total: 0, empenhado: 0, count: 0 };
    map[k].total += Number(r[valueKey] || 0);
    map[k].empenhado += Number(r.valor_empenhado || 0);
    map[k].count += 1;
  });
  return Object.entries(map).map(([name, v]) => ({ name, valor: Math.round(v.total), empenhado: Math.round(v.empenhado), count: v.count, execucao: pct(v.total, v.empenhado) })).sort((a, b) => b.valor - a.valor).slice(0, limit);
}

export function EmendasOrcamentariasTab() {
  const { user, signInWithGoogle } = useAuth();
  const [rows, setRows] = useState<EmendaOrcamentaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ano, setAno] = useState(String(currentYear));
  const [tipo, setTipo] = useState("all");
  const [tema, setTema] = useState("all");
  const [subtema, setSubtema] = useState("all");
  const [uf, setUf] = useState("all");
  const [risco, setRisco] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("emendas_orcamentarias_transparencia")
      .select("*")
      .eq("ano", Number(ano))
      .order("valor_pago", { ascending: false })
      .limit(5000);
    if (error) setNotice(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ano]);
  useEffect(() => { setPage(0); }, [tipo, tema, subtema, uf, risco, search]);

  const sync = async () => {
    if (!user) { await signInWithGoogle(); return; }
    setSyncing(true); setNotice(null);
    const { data, error } = await supabase.functions.invoke("sync-emendas-transparencia", { body: { ano: Number(ano), paginas: 5, incluirDocumentos: false } });
    if (error) setNotice(error.message);
    else setNotice(`Sincronização concluída: ${data?.upserted || 0} emendas orçamentárias atualizadas para ${ano}.`);
    await load();
    setSyncing(false);
  };

  const options = useMemo(() => ({
    tipos: [...new Set(rows.map((r) => r.tipo_emenda).filter(Boolean))].sort(),
    temas: [...new Set(rows.map((r) => r.tema_ia || "Outros"))].sort(),
    subtemas: [...new Set(rows.map((r) => r.subtema_ia).filter(Boolean))].sort() as string[],
    ufs: [...new Set(rows.map((r) => r.uf).filter(Boolean))].sort() as string[],
  }), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (tipo !== "all" && r.tipo_emenda !== tipo) return false;
    if (tema !== "all" && r.tema_ia !== tema) return false;
    if (subtema !== "all" && r.subtema_ia !== subtema) return false;
    if (uf !== "all" && r.uf !== uf) return false;
    if (risco !== "all" && r.risco_execucao !== risco) return false;
    const term = search.trim().toLowerCase();
    if (term && !`${r.codigo_emenda} ${r.nome_autor || ""} ${r.partido || ""} ${r.uf || ""} ${r.localidade_gasto || ""} ${r.funcao || ""} ${r.subfuncao || ""} ${r.tema_ia} ${r.subtema_ia || ""} ${r.resumo_ia || ""}`.toLowerCase().includes(term)) return false;
    return true;
  }), [rows, tipo, tema, subtema, uf, risco, search]);

  const stats = useMemo(() => {
    const empenhado = filtered.reduce((s, r) => s + Number(r.valor_empenhado || 0), 0);
    const liquidado = filtered.reduce((s, r) => s + Number(r.valor_liquidado || 0), 0);
    const pago = filtered.reduce((s, r) => s + Number(r.valor_pago || 0) + Number(r.valor_resto_pago || 0), 0);
    const baixo = filtered.filter((r) => r.valor_empenhado > 0 && (r.valor_pago + r.valor_resto_pago) / r.valor_empenhado < 0.1).length;
    return { empenhado, liquidado, pago, execucao: pct(pago, empenhado), baixo, altoRisco: filtered.filter((r) => r.risco_execucao === "Alto").length };
  }, [filtered]);

  const byTema = useMemo(() => groupSum(filtered, "tema_ia"), [filtered]);
  const bySubtema = useMemo(() => groupSum(filtered, "subtema_ia"), [filtered]);
  const byAutor = useMemo(() => groupSum(filtered, "nome_autor", "valor_pago", 15), [filtered]);
  const byPartido = useMemo(() => groupSum(filtered, "partido"), [filtered]);
  const byUf = useMemo(() => groupSum(filtered, "uf"), [filtered]);
  const byTipo = useMemo(() => groupSum(filtered, "tipo_emenda"), [filtered]);
  const trend = useMemo(() => {
    const map: Record<number, { ano: number; empenhado: number; liquidado: number; pago: number }> = {};
    rows.forEach((r) => { map[r.ano] = map[r.ano] || { ano: r.ano, empenhado: 0, liquidado: 0, pago: 0 }; map[r.ano].empenhado += Number(r.valor_empenhado || 0); map[r.ano].liquidado += Number(r.valor_liquidado || 0); map[r.ano].pago += Number(r.valor_pago || 0) + Number(r.valor_resto_pago || 0); });
    return Object.values(map).sort((a, b) => a.ano - b.ano).map((r) => ({ ...r, empenhado: Math.round(r.empenhado), liquidado: Math.round(r.liquidado), pago: Math.round(r.pago) }));
  }, [rows]);
  const alerts = useMemo(() => filtered.filter((r) => r.valor_empenhado > 0 && (r.valor_pago + r.valor_resto_pago) / r.valor_empenhado < 0.1).sort((a, b) => b.valor_empenhado - a.valor_empenhado).slice(0, 8), [filtered]);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const exportRows = filtered.map((r) => ({ Código: r.codigo_emenda, Ano: r.ano, Tipo: r.tipo_emenda, Autor: r.nome_autor || r.autor || "", Partido: r.partido || "", UF: r.uf || "", Tema: r.tema_ia, Subtema: r.subtema_ia || "", Função: r.funcao || "", Subfunção: r.subfuncao || "", Empenhado: r.valor_empenhado, Liquidado: r.valor_liquidado, Pago: r.valor_pago + r.valor_resto_pago, Execução: `${pct(r.valor_pago + r.valor_resto_pago, r.valor_empenhado)}%`, Risco: r.risco_execucao, Resumo: r.resumo_ia || "" }));
  const exportCsv = () => downloadCsv(`emendas-orcamentarias-${ano}.csv`, exportRows);
  const exportPdf = () => downloadPdfReport({
    title: `Emendas orçamentárias — ${ano}`,
    subtitle: `${filtered.length} emendas do Portal da Transparência no recorte filtrado. Valores: ${brl(stats.empenhado)} empenhados e ${brl(stats.pago)} pagos.` ,
    insights: [
      `Taxa de execução financeira do recorte: ${stats.execucao}% do valor empenhado pago.`,
      `Tema com maior pagamento: ${byTema[0]?.name || "sem dados"} (${brl(byTema[0]?.valor || 0)}).`,
      `Autor com maior pagamento: ${byAutor[0]?.name || "sem dados"} (${brl(byAutor[0]?.valor || 0)}).`,
      `${stats.baixo} emendas têm alto empenho e baixa execução de pagamento, sinalizando gargalo potencial.`,
    ],
    charts: [
      { title: "Pagamento por tema", data: byTema.slice(0, 8).map((d) => ({ label: d.name, value: d.valor })) },
      { title: "Pagamento por partido", data: byPartido.slice(0, 8).map((d) => ({ label: d.name, value: d.valor })) },
      { title: "Pagamento por UF", data: byUf.slice(0, 8).map((d) => ({ label: d.name, value: d.valor })) },
    ],
    rows: exportRows.slice(0, 25),
    filename: `relatorio-emendas-orcamentarias-${ano}.pdf`,
  });

  if (loading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline mr-2 animate-spin" size={16}/>Carregando emendas orçamentárias…</CardContent></Card>;

  return <div className="space-y-4">
    {notice && <Card className="border-primary/20 bg-primary/5"><CardContent className="p-3 text-xs text-muted-foreground">{notice}</CardContent></Card>}

    <div className="flex flex-wrap items-center gap-2">
      <Select value={ano} onValueChange={setAno}><SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
      <Button onClick={sync} disabled={syncing} size="sm" className="h-9 gap-1 text-xs">{syncing ? <Loader2 size={13} className="animate-spin"/> : <RefreshCcw size={13}/>}Sincronizar Portal</Button>
      <Button variant="outline" onClick={exportCsv} disabled={!filtered.length} size="sm" className="h-9 gap-1 text-xs"><Download size={13}/>CSV</Button>
      <Button onClick={exportPdf} disabled={!filtered.length} size="sm" className="h-9 gap-1 text-xs"><FileDown size={13}/>PDF executivo</Button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Emendas</p><p className="text-2xl font-black">{filtered.length}</p></CardContent></Card>
      <Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Empenhado</p><p className="text-xl font-black">{compact(stats.empenhado)}</p></CardContent></Card>
      <Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Liquidado</p><p className="text-xl font-black">{compact(stats.liquidado)}</p></CardContent></Card>
      <Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Pago</p><p className="text-xl font-black text-governo">{compact(stats.pago)}</p></CardContent></Card>
      <Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Execução</p><p className="text-2xl font-black text-primary">{stats.execucao}%</p><Progress value={stats.execucao} className="h-1.5 mt-1"/></CardContent></Card>
      <Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Alto risco</p><p className="text-2xl font-black text-oposicao">{stats.altoRisco}</p></CardContent></Card>
    </div>

    <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex gap-2"><Search size={14}/>Filtros detalhados</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2"><div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-2.5 text-muted-foreground"/><Input className="pl-9 h-9 text-xs" placeholder="Autor, tema, função, localidade..." value={search} onChange={(e) => setSearch(e.target.value)}/></div><Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Tipo"/></SelectTrigger><SelectContent><SelectItem value="all">Tipos</SelectItem>{options.tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={tema} onValueChange={setTema}><SelectTrigger className="w-40 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Temas IA</SelectItem>{options.temas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={subtema} onValueChange={setSubtema}><SelectTrigger className="w-40 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Subtemas</SelectItem>{options.subtemas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={uf} onValueChange={setUf}><SelectTrigger className="w-24 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">UFs</SelectItem>{options.ufs.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={risco} onValueChange={setRisco}><SelectTrigger className="w-32 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Risco</SelectItem><SelectItem value="Alto">Alto</SelectItem><SelectItem value="Médio">Médio</SelectItem><SelectItem value="Baixo">Baixo</SelectItem></SelectContent></Select></div></CardContent></Card>

    {!rows.length && <Card className="border-dashed"><CardContent className="py-10 text-center"><Sparkles className="mx-auto mb-3 text-primary"/><p className="font-bold">Nenhuma emenda orçamentária sincronizada para {ano}.</p><p className="text-sm text-muted-foreground mt-1">Use “Sincronizar Portal” para buscar dados econômicos oficiais do Portal da Transparência e tematizar com IA.</p></CardContent></Card>}

    {!!filtered.length && <div className="grid lg:grid-cols-3 gap-3">
      <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><TrendingUp size={16}/>Pagamento por tema e subtema</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={byTema} layout="vertical" margin={{ left: 90 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis type="number" tickFormatter={compact}/><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" name="Pago" radius={[0,4,4,0]}>{byTema.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Funil financeiro</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={[{ name: "Empenhado", valor: stats.empenhado }, { name: "Liquidado", valor: stats.liquidado }, { name: "Pago", valor: stats.pago }]}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name" tick={{ fontSize: 10 }}/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ranking por autor</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={330}><BarChart data={byAutor.slice(0, 10)} layout="vertical" margin={{ left: 105 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis type="number" tickFormatter={compact}/><YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 9 }}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--governo))" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Partidos</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={330}><BarChart data={byPartido}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">UF do gasto/autor</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={330}><BarChart data={byUf}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--centro))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card>
      {trend.length > 1 && <Card className="lg:col-span-3"><CardHeader className="pb-2"><CardTitle className="text-sm">Tendência anual de execução</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={260}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="ano"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Legend/><Line dataKey="empenhado" name="Empenhado" stroke="hsl(var(--primary))" strokeWidth={2}/><Line dataKey="liquidado" name="Liquidado" stroke="hsl(var(--centro))" strokeWidth={2}/><Line dataKey="pago" name="Pago" stroke="hsl(var(--governo))" strokeWidth={2}/></LineChart></ResponsiveContainer></CardContent></Card>}
    </div>}

    {!!alerts.length && <Card className="border-oposicao/30"><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><AlertTriangle size={16} className="text-oposicao"/>Emendas com alto empenho e baixa execução</CardTitle></CardHeader><CardContent><div className="grid md:grid-cols-2 gap-2">{alerts.map((r) => <div key={r.id} className="rounded-md border p-3"><div className="flex justify-between gap-2"><p className="font-bold text-xs">{r.codigo_emenda} · {r.nome_autor || "Autor não informado"}</p><Badge variant="outline" className="text-oposicao border-oposicao/30">{pct(r.valor_pago + r.valor_resto_pago, r.valor_empenhado)}%</Badge></div><p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.tema_ia} · {r.subtema_ia || r.funcao || "Sem subtema"}</p><p className="text-xs mt-2">Empenhado: <b>{brl(r.valor_empenhado)}</b> · Pago: <b>{brl(r.valor_pago + r.valor_resto_pago)}</b></p></div>)}</div></CardContent></Card>}

    <Card><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm flex gap-2"><ShieldCheck size={16}/>Dados completos</CardTitle><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button><span className="text-xs font-bold text-muted-foreground">{page + 1}/{totalPages}</span><Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div></div></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Emenda</TableHead><TableHead>Autor</TableHead><TableHead>Tema</TableHead><TableHead>Valores</TableHead><TableHead>Execução</TableHead></TableRow></TableHeader><TableBody>{paginated.map((r) => <TableRow key={r.id}><TableCell className="min-w-[180px]"><p className="font-bold text-xs text-primary">{r.codigo_emenda}</p><p className="text-[10px] text-muted-foreground">{r.tipo_emenda} · {r.numero_emenda || "s/n"}</p></TableCell><TableCell className="min-w-[180px]"><p className="text-xs font-medium">{r.nome_autor || r.autor || "—"}</p><p className="text-[10px] text-muted-foreground">{[r.partido, r.uf].filter(Boolean).join("/") || r.localidade_gasto || "—"}</p></TableCell><TableCell className="min-w-[220px]"><Badge variant="secondary" className="text-[10px]">{r.tema_ia}</Badge><p className="text-[10px] mt-1 text-muted-foreground">{r.subtema_ia || r.subfuncao || "Sem subtema"}</p>{r.resumo_ia && <p className="text-[10px] mt-1 line-clamp-2">{r.resumo_ia}</p>}</TableCell><TableCell className="min-w-[170px] text-xs"><p>Emp.: <b>{brl(r.valor_empenhado)}</b></p><p>Pago: <b className="text-governo">{brl(r.valor_pago + r.valor_resto_pago)}</b></p></TableCell><TableCell className="min-w-[150px]"><div className="flex items-center gap-2"><Progress value={pct(r.valor_pago + r.valor_resto_pago, r.valor_empenhado)} className="h-1.5"/><span className="text-xs font-bold">{pct(r.valor_pago + r.valor_resto_pago, r.valor_empenhado)}%</span></div><Badge variant={r.risco_execucao === "Alto" ? "destructive" : "outline"} className="text-[10px] mt-2">{r.estagio_execucao} · risco {r.risco_execucao}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}
