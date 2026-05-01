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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Building2, Download, ExternalLink, FileDown, GraduationCap, Loader2, MapPin, RefreshCcw, Search, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import { downloadCsv, downloadPdfReport } from "@/lib/exportData";
import { SyncLogViewer } from "@/components/SyncLogViewer";

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
  documentos?: unknown;
  raw_data?: Record<string, unknown>;
}

type RiskRow = ReturnType<typeof groupRisk>[number];
type Selection = { type: "tema_ia" | "nome_autor"; row: RiskRow } | null;

const COLORS = ["hsl(var(--primary))", "hsl(var(--governo))", "hsl(var(--oposicao))", "hsl(var(--centro))", "hsl(var(--muted-foreground))", "hsl(45 80% 55%)", "hsl(190 70% 42%)"];
const PAGE_SIZE = 25;
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2021 }, (_, i) => currentYear - i);
const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n || 0));
const pct = (pago: number, base: number) => (base > 0 ? Math.min(100, Math.round((pago / base) * 100)) : 0);
const compact = (n: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n || 0));
const riskWeight = { Alto: 3, Médio: 2, Baixo: 1 } as const;

function getPaid(r: EmendaOrcamentaria) { return Number(r.valor_pago || 0) + Number(r.valor_resto_pago || 0); }
function clean(v: unknown) { return String(v ?? "").trim(); }
function searchPortalUrl(r: EmendaOrcamentaria) {
  const docs = Array.isArray(r.documentos) ? r.documentos : [];
  const candidates = [r.raw_data?.link, r.raw_data?.url, r.raw_data?.uri, r.raw_data?.urlDocumento, r.raw_data?.linkDetalhamento, ...docs.flatMap((d: any) => [d?.link, d?.url, d?.uri, d?.urlDocumento])].map(clean).filter(Boolean);
  const direct = candidates.find((u) => /^https?:\/\//i.test(u));
  if (direct) return direct;
  return `https://portaldatransparencia.gov.br/busca?termo=${encodeURIComponent(r.codigo_emenda || r.numero_emenda || "emenda parlamentar")}`;
}
function typeLabel(tipo: string) {
  const t = tipo.toLowerCase();
  if (/pix|transferência especial|transferencia especial/.test(t)) return "PIX";
  if (/bancada/.test(t)) return "Bancada";
  if (/individual/.test(t)) return "Individual";
  if (/relator/.test(t)) return "Relator";
  if (/comiss/.test(t)) return "Comissão";
  return tipo || "Tipo n/i";
}
function groupSum(rows: EmendaOrcamentaria[], key: keyof EmendaOrcamentaria, valueKey: keyof EmendaOrcamentaria = "valor_pago", limit = 10) {
  const map: Record<string, { total: number; empenhado: number; count: number }> = {};
  rows.forEach((r) => {
    const k = String(r[key] || "Não informado");
    map[k] = map[k] || { total: 0, empenhado: 0, count: 0 };
    map[k].total += valueKey === "valor_pago" ? getPaid(r) : Number(r[valueKey] || 0);
    map[k].empenhado += Number(r.valor_empenhado || 0);
    map[k].count += 1;
  });
  return Object.entries(map).map(([name, v]) => ({ name, valor: Math.round(v.total), empenhado: Math.round(v.empenhado), count: v.count, execucao: pct(v.total, v.empenhado) })).sort((a, b) => b.valor - a.valor).slice(0, limit);
}
function groupRisk(rows: EmendaOrcamentaria[], key: "tema_ia" | "nome_autor", limit = 50) {
  const map: Record<string, { name: string; empenhado: number; liquidado: number; pago: number; count: number; risco: "Baixo" | "Médio" | "Alto" }> = {};
  rows.forEach((r) => {
    const name = String(r[key] || r.autor || "Não informado");
    map[name] = map[name] || { name, empenhado: 0, liquidado: 0, pago: 0, count: 0, risco: "Baixo" };
    map[name].empenhado += Number(r.valor_empenhado || 0);
    map[name].liquidado += Number(r.valor_liquidado || 0);
    map[name].pago += getPaid(r);
    map[name].count += 1;
    if (riskWeight[r.risco_execucao] > riskWeight[map[name].risco]) map[name].risco = r.risco_execucao;
  });
  return Object.values(map).map((v) => ({ ...v, taxaPagamento: pct(v.pago, v.liquidado), taxaExecucao: pct(v.pago, v.empenhado) })).sort((a, b) => riskWeight[b.risco] - riskWeight[a.risco] || a.taxaExecucao - b.taxaExecucao || b.empenhado - a.empenhado).slice(0, limit);
}
function rankingRows(rows: RiskRow[]) {
  return rows.map((r) => ({ Nome: r.name, Risco: r.risco, Emendas: r.count, Empenhado: Math.round(r.empenhado), Liquidado: Math.round(r.liquidado), Pago: Math.round(r.pago), "Taxa pagamento": `${r.taxaPagamento}%`, "Taxa execução": `${r.taxaExecucao}%` }));
}
function countDistinct(rows: EmendaOrcamentaria[], key: keyof EmendaOrcamentaria) { return new Set(rows.map((r) => clean(r[key])).filter(Boolean)).size; }

export function EmendasOrcamentariasTab() {
  const { user, signInWithGoogle } = useAuth();
  const [rows, setRows] = useState<EmendaOrcamentaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncEvents, setSyncEvents] = useState<{ id: string; step: string; message: string; created_at: string }[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [ano, setAno] = useState(String(currentYear));
  const [tipo, setTipo] = useState("all");
  const [tema, setTema] = useState("all");
  const [subtema, setSubtema] = useState("all");
  const [uf, setUf] = useState("all");
  const [risco, setRisco] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("emendas_orcamentarias_transparencia").select("*").eq("ano", Number(ano)).order("valor_pago", { ascending: false }).limit(5000);
    if (error) setNotice(error.message); else setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [ano]);
  useEffect(() => { setPage(0); }, [tipo, tema, subtema, uf, risco, search]);

  const sync = async () => {
    if (!user) { await signInWithGoogle(); return; }
    setSyncing(true); setNotice(null); setSyncError(null); setSyncStatus("running");
    setSyncEvents([{ id: "start", step: "inicio", message: `Iniciando sync de ${ano} com filtros atuais...`, created_at: new Date().toISOString() }]);
    const { data, error } = await supabase.functions.invoke("sync-emendas-transparencia", { body: { ano: Number(ano), tipoEmenda: tipo === "all" ? undefined : tipo, paginas: 5, incluirDocumentos: false } });
    if (error) {
      setNotice(error.message); setSyncError(error.message); setSyncStatus("error");
      setSyncEvents((prev) => [...prev, { id: "error", step: "error", message: `Falha no sync: ${error.message}`, created_at: new Date().toISOString() }]);
    } else {
      const empty = (data as any)?.empty_reason as string | undefined;
      const fallback = (data as any)?.fallback_usado;
      const anoUsado = (data as any)?.ano_usado;
      if (empty) {
        setNotice(`⚠️ ${empty}`);
      } else if (fallback && anoUsado && anoUsado !== Number(ano)) {
        setNotice(`Portal sem dados para ${ano} — usei fallback automático: ${data?.upserted || 0} emendas de ${anoUsado} foram gravadas. Mude o filtro de ano para visualizá-las.`);
      } else {
        setNotice(`Sincronização concluída: ${data?.upserted || 0} emendas atualizadas para ${ano}.`);
      }
      setSyncStatus("completed");
      setSyncEvents((prev) => [...prev, { id: "done", step: "concluido", message: `Run ${data?.runId || "local"}: ${data?.fetched || 0} retornadas; ${data?.upserted || 0} gravadas/classificadas.`, created_at: new Date().toISOString() }]);
    }
    await load(); setSyncing(false);
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
    if (term && !`${r.codigo_emenda} ${r.nome_autor || ""} ${r.partido || ""} ${r.uf || ""} ${r.localidade_gasto || ""} ${r.funcao || ""} ${r.subfuncao || ""} ${r.tema_ia} ${r.subtema_ia || ""} ${r.publico_beneficiado || ""} ${r.resumo_ia || ""}`.toLowerCase().includes(term)) return false;
    return true;
  }), [rows, tipo, tema, subtema, uf, risco, search]);

  const stats = useMemo(() => {
    const empenhado = filtered.reduce((s, r) => s + Number(r.valor_empenhado || 0), 0);
    const liquidado = filtered.reduce((s, r) => s + Number(r.valor_liquidado || 0), 0);
    const pago = filtered.reduce((s, r) => s + getPaid(r), 0);
    return { empenhado, liquidado, pago, execucao: pct(pago, empenhado), pagamento: pct(pago, liquidado), altoRisco: filtered.filter((r) => r.risco_execucao === "Alto").length };
  }, [filtered]);
  const byTema = useMemo(() => groupSum(filtered, "tema_ia"), [filtered]);
  const byAutor = useMemo(() => groupSum(filtered, "nome_autor", "valor_pago", 15), [filtered]);
  const byPartido = useMemo(() => groupSum(filtered, "partido"), [filtered]);
  const byUf = useMemo(() => groupSum(filtered, "uf"), [filtered]);
  const riskByTema = useMemo(() => groupRisk(filtered, "tema_ia"), [filtered]);
  const riskByAutor = useMemo(() => groupRisk(filtered, "nome_autor"), [filtered]);
  const impact = useMemo(() => {
    const educationRows = filtered.filter((r) => /educa|escola|ensino|creche/i.test(`${r.tema_ia} ${r.subtema_ia || ""} ${r.funcao || ""} ${r.subfuncao || ""} ${r.resumo_ia || ""}`));
    const schoolNames = [...new Set(educationRows.map((r) => clean(r.publico_beneficiado || r.localidade_gasto || r.resumo_ia)).filter((x) => /escola|colégio|colegio|creche|instituto/i.test(x)))];
    const health = filtered.filter((r) => /saúde|saude|hospital|ubs|médic|medic/i.test(`${r.tema_ia} ${r.subtema_ia || ""} ${r.funcao || ""} ${r.resumo_ia || ""}`)).length;
    const security = filtered.filter((r) => /segurança|seguranca|polícia|policia|defesa/i.test(`${r.tema_ia} ${r.subtema_ia || ""} ${r.funcao || ""} ${r.resumo_ia || ""}`)).length;
    const munis = countDistinct(filtered, "localidade_gasto");
    return { educationRows, schoolNames, health, security, munis, autores: countDistinct(filtered, "nome_autor") };
  }, [filtered]);
  const trend = useMemo(() => Object.values(rows.reduce((map, r) => { map[r.ano] = map[r.ano] || { ano: r.ano, empenhado: 0, liquidado: 0, pago: 0 }; map[r.ano].empenhado += Number(r.valor_empenhado || 0); map[r.ano].liquidado += Number(r.valor_liquidado || 0); map[r.ano].pago += getPaid(r); return map; }, {} as Record<number, { ano: number; empenhado: number; liquidado: number; pago: number }>)).sort((a, b) => a.ano - b.ano), [rows]);
  const alerts = useMemo(() => filtered.filter((r) => r.valor_empenhado > 0 && getPaid(r) / r.valor_empenhado < 0.1).sort((a, b) => b.valor_empenhado - a.valor_empenhado).slice(0, 8), [filtered]);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const selectedRows = useMemo(() => selection ? filtered.filter((r) => String(r[selection.type] || r.autor || "Não informado") === selection.row.name) : [], [filtered, selection]);

  const exportRankingCsv = (kind: "tema" | "autor") => downloadCsv(`ranking-risco-${kind}-${ano}.csv`, rankingRows(kind === "tema" ? riskByTema : riskByAutor));
  const exportRankingPdf = (kind: "tema" | "autor") => {
    const data = kind === "tema" ? riskByTema : riskByAutor;
    downloadPdfReport({ title: `Ranking de risco por ${kind} — ${ano}`, subtitle: `Recorte filtrado: ${filtered.length} emendas, ${brl(stats.pago)} pagos.`, insights: [`Maior risco: ${data[0]?.name || "sem dados"} (${data[0]?.risco || "n/i"}).`, `Taxa de pagamento do recorte: ${stats.pagamento}%.`, `Taxa de execução do recorte: ${stats.execucao}%.`], charts: [{ title: `Pago por ${kind}`, data: data.slice(0, 10).map((d) => ({ label: d.name, value: Math.round(d.pago) })) }], rows: rankingRows(data).slice(0, 30), filename: `ranking-risco-${kind}-${ano}.pdf` });
  };
  const exportRows = filtered.map((r) => ({ Código: r.codigo_emenda, Ano: r.ano, Tipo: r.tipo_emenda, Autor: r.nome_autor || r.autor || "", Partido: r.partido || "", UF: r.uf || "", Tema: r.tema_ia, Subtema: r.subtema_ia || "", Empenhado: r.valor_empenhado, Liquidado: r.valor_liquidado, Pago: getPaid(r), "Pago/Liquidado": `${pct(getPaid(r), r.valor_liquidado)}%`, "Pago/Empenhado": `${pct(getPaid(r), r.valor_empenhado)}%`, Risco: r.risco_execucao, Link: searchPortalUrl(r), Resumo: r.resumo_ia || "" }));
  const exportCsv = () => downloadCsv(`emendas-orcamentarias-${ano}.csv`, exportRows);
  const exportPdf = () => downloadPdfReport({ title: `Emendas orçamentárias — ${ano}`, subtitle: `${filtered.length} emendas no recorte filtrado. ${brl(stats.empenhado)} empenhados e ${brl(stats.pago)} pagos.`, insights: [`Execução financeira: ${stats.execucao}% do empenhado pago.`, `Pagamento sobre liquidação: ${stats.pagamento}%.`, `${impact.munis} localidades/municípios e ${impact.autores} autores identificados.`, `Educação: ${impact.educationRows.length} emendas; Saúde: ${impact.health}; Segurança: ${impact.security}.`], charts: [{ title: "Pagamento por tema", data: byTema.slice(0, 8).map((d) => ({ label: d.name, value: d.valor })) }, { title: "Pagamento por partido", data: byPartido.slice(0, 8).map((d) => ({ label: d.name, value: d.valor })) }, { title: "Pagamento por UF", data: byUf.slice(0, 8).map((d) => ({ label: d.name, value: d.valor })) }], rows: exportRows.slice(0, 25), filename: `relatorio-emendas-orcamentarias-${ano}.pdf` });

  if (loading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline mr-2 animate-spin" size={16}/>Carregando emendas orçamentárias…</CardContent></Card>;

  const RiskTable = ({ title, rows, type }: { title: string; rows: RiskRow[]; type: "tema_ia" | "nome_autor" }) => <div className="overflow-x-auto"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{title}</p><Table><TableHeader><TableRow><TableHead>{type === "tema_ia" ? "Tema" : "Autor"}</TableHead><TableHead>Risco</TableHead><TableHead>Pago/Liquidado</TableHead><TableHead>Pago/Empenhado</TableHead><TableHead>Pago</TableHead></TableRow></TableHeader><TableBody>{rows.slice(0, 12).map((r) => <TableRow key={r.name} onClick={() => setSelection({ type, row: r })} className="cursor-pointer hover:bg-muted/60"><TableCell className="font-bold text-xs min-w-[140px]">{r.name}<p className="text-[10px] font-normal text-muted-foreground">{r.count} emendas · clique para validar</p></TableCell><TableCell><Badge variant={r.risco === "Alto" ? "destructive" : "outline"} className="text-[10px]">{r.risco}</Badge></TableCell><TableCell className="min-w-[120px]"><div className="flex items-center gap-2"><Progress value={r.taxaPagamento} className="h-1.5"/><span className="text-xs font-bold">{r.taxaPagamento}%</span></div></TableCell><TableCell className="min-w-[120px]"><div className="flex items-center gap-2"><Progress value={r.taxaExecucao} className="h-1.5"/><span className="text-xs font-bold">{r.taxaExecucao}%</span></div></TableCell><TableCell className="text-xs font-bold">{brl(r.pago)}</TableCell></TableRow>)}</TableBody></Table></div>;

  return <div className="space-y-4">
    {notice && <Card className="border-primary/20 bg-primary/5"><CardContent className="p-3 text-xs text-muted-foreground">{notice}</CardContent></Card>}
    <div className="flex flex-wrap items-center gap-2"><Select value={ano} onValueChange={setAno}><SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select><Select value={tema} onValueChange={setTema}><SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Tema do ranking"/></SelectTrigger><SelectContent><SelectItem value="all">Todos os temas</SelectItem>{options.temas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Button onClick={sync} disabled={syncing} size="sm" className="h-9 gap-1 text-xs">{syncing ? <Loader2 size={13} className="animate-spin"/> : <RefreshCcw size={13}/>}Sincronizar Portal</Button><Button variant="outline" onClick={exportCsv} disabled={!filtered.length} size="sm" className="h-9 gap-1 text-xs"><Download size={13}/>CSV geral</Button><Button onClick={exportPdf} disabled={!filtered.length} size="sm" className="h-9 gap-1 text-xs"><FileDown size={13}/>PDF executivo</Button></div>
    <SyncLogViewer events={syncEvents} status={syncStatus} error={syncError} />

    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3"><Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Emendas</p><p className="text-2xl font-black">{filtered.length}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Empenhado</p><p className="text-xl font-black">{compact(stats.empenhado)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Liquidado</p><p className="text-xl font-black">{compact(stats.liquidado)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Pago</p><p className="text-xl font-black text-governo">{compact(stats.pago)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Execução</p><p className="text-2xl font-black text-primary">{stats.execucao}%</p><Progress value={stats.execucao} className="h-1.5 mt-1"/></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Alto risco</p><p className="text-2xl font-black text-oposicao">{stats.altoRisco}</p></CardContent></Card></div>

    <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex gap-2"><Search size={14}/>Filtros antes do ranking</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2"><div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-2.5 text-muted-foreground"/><Input className="pl-9 h-9 text-xs" placeholder="Autor, tema, município, escola, função..." value={search} onChange={(e) => setSearch(e.target.value)}/></div><Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Tipo"/></SelectTrigger><SelectContent><SelectItem value="all">Tipos</SelectItem>{options.tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={subtema} onValueChange={setSubtema}><SelectTrigger className="w-40 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Subtemas</SelectItem>{options.subtemas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={uf} onValueChange={setUf}><SelectTrigger className="w-24 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">UFs</SelectItem>{options.ufs.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Select value={risco} onValueChange={setRisco}><SelectTrigger className="w-32 h-9 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Risco</SelectItem><SelectItem value="Alto">Alto</SelectItem><SelectItem value="Médio">Médio</SelectItem><SelectItem value="Baixo">Baixo</SelectItem></SelectContent></Select></div></CardContent></Card>

    {!rows.length && <Card className="border-dashed"><CardContent className="py-10 text-center"><Sparkles className="mx-auto mb-3 text-primary"/><p className="font-bold">Nenhuma emenda orçamentária sincronizada para {ano}.</p><p className="text-sm text-muted-foreground mt-1">Use “Sincronizar Portal” para buscar dados oficiais e tematizar com IA.</p></CardContent></Card>}

    {!!filtered.length && <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3"><Card><CardContent className="p-3"><MapPin size={16} className="text-primary mb-2"/><p className="text-2xl font-black">{impact.munis}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Municípios/localidades atendidos</p></CardContent></Card><Card><CardContent className="p-3"><GraduationCap size={16} className="text-primary mb-2"/><p className="text-2xl font-black">{impact.educationRows.length}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Emendas ligadas à educação/escolas</p><p className="text-[10px] text-muted-foreground mt-1">{impact.schoolNames.slice(0, 2).join("; ") || "Entidades não identificadas no retorno oficial"}</p></CardContent></Card><Card><CardContent className="p-3"><Building2 size={16} className="text-governo mb-2"/><p className="text-2xl font-black">{impact.health}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Saúde/hospitais/UBS</p></CardContent></Card><Card><CardContent className="p-3"><Users size={16} className="text-oposicao mb-2"/><p className="text-2xl font-black">{impact.security}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Segurança/defesa</p></CardContent></Card></div>}

    {!!filtered.length && <div className="grid lg:grid-cols-3 gap-3"><Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><TrendingUp size={16}/>Pagamento por tema</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={byTema} layout="vertical" margin={{ left: 90 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis type="number" tickFormatter={compact}/><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" name="Pago" radius={[0,4,4,0]}>{byTema.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Funil financeiro</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={[{ name: "Empenhado", valor: stats.empenhado }, { name: "Liquidado", valor: stats.liquidado }, { name: "Pago", valor: stats.pago }]}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name" tick={{ fontSize: 10 }}/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ranking por autor</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={330}><BarChart data={byAutor.slice(0, 10)} layout="vertical" margin={{ left: 105 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis type="number" tickFormatter={compact}/><YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 9 }}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--governo))" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Partidos</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={330}><BarChart data={byPartido}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">UF do gasto/autor</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={330}><BarChart data={byUf}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="name"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Bar dataKey="valor" fill="hsl(var(--centro))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card>{trend.length > 1 && <Card className="lg:col-span-3"><CardHeader className="pb-2"><CardTitle className="text-sm">Tendência anual de execução</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={260}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="ano"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v: any) => brl(Number(v))}/><Legend/><Line dataKey="empenhado" name="Empenhado" stroke="hsl(var(--primary))" strokeWidth={2}/><Line dataKey="liquidado" name="Liquidado" stroke="hsl(var(--centro))" strokeWidth={2}/><Line dataKey="pago" name="Pago" stroke="hsl(var(--governo))" strokeWidth={2}/></LineChart></ResponsiveContainer></CardContent></Card>}</div>}

    {!!filtered.length && <Card><CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-sm flex gap-2"><AlertTriangle size={16}/>Ranking de execução por risco</CardTitle><div className="flex flex-wrap gap-1"><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportRankingCsv("tema")}>CSV tema</Button><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportRankingPdf("tema")}>PDF tema</Button><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportRankingCsv("autor")}>CSV autor</Button><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportRankingPdf("autor")}>PDF autor</Button></div></div></CardHeader><CardContent className="grid lg:grid-cols-2 gap-4"><RiskTable title="Por tema" rows={riskByTema} type="tema_ia"/><RiskTable title="Por autor" rows={riskByAutor} type="nome_autor"/></CardContent></Card>}

    {!!alerts.length && <Card className="border-oposicao/30"><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><AlertTriangle size={16} className="text-oposicao"/>Emendas com alto empenho e baixa execução</CardTitle></CardHeader><CardContent><div className="grid md:grid-cols-2 gap-2">{alerts.map((r) => <div key={r.id} className="rounded-md border p-3"><div className="flex justify-between gap-2"><p className="font-bold text-xs">{r.codigo_emenda} · {r.nome_autor || "Autor não informado"}</p><Badge variant="outline" className="text-oposicao border-oposicao/30">{pct(getPaid(r), r.valor_empenhado)}%</Badge></div><p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.tema_ia} · {r.subtema_ia || r.funcao || "Sem subtema"}</p><p className="text-xs mt-2">Empenhado: <b>{brl(r.valor_empenhado)}</b> · Pago: <b>{brl(getPaid(r))}</b></p></div>)}</div></CardContent></Card>}

    <Card><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm flex gap-2"><ShieldCheck size={16}/>Dados completos</CardTitle><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button><span className="text-xs font-bold text-muted-foreground">{page + 1}/{totalPages}</span><Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div></div></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Emenda</TableHead><TableHead>Autor</TableHead><TableHead>Tema</TableHead><TableHead>Valores</TableHead><TableHead>Execução</TableHead><TableHead>Link</TableHead></TableRow></TableHeader><TableBody>{paginated.map((r) => <TableRow key={r.id}><TableCell className="min-w-[180px]"><p className="font-bold text-xs text-primary">{r.codigo_emenda}</p><p className="text-[10px] text-muted-foreground">{typeLabel(r.tipo_emenda)} · {r.numero_emenda || "s/n"}</p></TableCell><TableCell className="min-w-[180px]"><p className="text-xs font-medium">{r.nome_autor || r.autor || "—"}</p><p className="text-[10px] text-muted-foreground">{[r.partido, r.uf].filter(Boolean).join("/") || r.localidade_gasto || "—"}</p></TableCell><TableCell className="min-w-[220px]"><Badge variant="secondary" className="text-[10px]">{r.tema_ia}</Badge><p className="text-[10px] mt-1 text-muted-foreground">{r.subtema_ia || r.subfuncao || "Sem subtema"}</p>{r.resumo_ia && <p className="text-[10px] mt-1 line-clamp-2">{r.resumo_ia}</p>}</TableCell><TableCell className="min-w-[170px] text-xs"><p>Emp.: <b>{brl(r.valor_empenhado)}</b></p><p>Liq.: <b>{brl(r.valor_liquidado)}</b></p><p>Pago: <b className="text-governo">{brl(getPaid(r))}</b></p></TableCell><TableCell className="min-w-[150px]"><div className="flex items-center gap-2"><Progress value={pct(getPaid(r), r.valor_empenhado)} className="h-1.5"/><span className="text-xs font-bold">{pct(getPaid(r), r.valor_empenhado)}%</span></div><Badge variant={r.risco_execucao === "Alto" ? "destructive" : "outline"} className="text-[10px] mt-2">{r.estagio_execucao} · risco {r.risco_execucao}</Badge></TableCell><TableCell><a href={searchPortalUrl(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><ExternalLink size={12}/>Ver emenda</a></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

    <Dialog open={!!selection} onOpenChange={(open) => !open && setSelection(null)}><DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{selection?.type === "tema_ia" ? "Validação do tema" : "Validação do autor"}: {selection?.row.name}</DialogTitle><DialogDescription>Emendas usadas para calcular risco, taxa de pagamento e taxa de execução.</DialogDescription></DialogHeader>{selection && <div className="space-y-3"><div className="grid grid-cols-2 md:grid-cols-5 gap-2"><Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">Emendas</p><p className="text-xl font-black">{selectedRows.length}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">Empenhado</p><p className="text-lg font-black">{compact(selection.row.empenhado)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">Liquidado</p><p className="text-lg font-black">{compact(selection.row.liquidado)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">Pago</p><p className="text-lg font-black text-governo">{compact(selection.row.pago)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground font-bold">Risco</p><Badge variant={selection.row.risco === "Alto" ? "destructive" : "outline"}>{selection.row.risco}</Badge></CardContent></Card></div><div className="grid md:grid-cols-2 gap-3"><div><div className="flex justify-between text-xs mb-1"><b>Pago/Liquidado</b><span>{selection.row.taxaPagamento}%</span></div><Progress value={selection.row.taxaPagamento} className="h-2"/></div><div><div className="flex justify-between text-xs mb-1"><b>Pago/Empenhado</b><span>{selection.row.taxaExecucao}%</span></div><Progress value={selection.row.taxaExecucao} className="h-2"/></div></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Emenda</TableHead><TableHead>Autor/Tema</TableHead><TableHead>Taxas</TableHead><TableHead>Valores</TableHead><TableHead>Risco</TableHead><TableHead>Link</TableHead></TableRow></TableHeader><TableBody>{selectedRows.sort((a, b) => riskWeight[b.risco_execucao] - riskWeight[a.risco_execucao] || b.valor_empenhado - a.valor_empenhado).map((r) => <TableRow key={r.id}><TableCell className="min-w-[160px]"><p className="font-bold text-xs text-primary">{r.codigo_emenda}</p><p className="text-[10px] text-muted-foreground">{typeLabel(r.tipo_emenda)} · {r.ano}</p></TableCell><TableCell className="min-w-[220px]"><p className="text-xs font-bold">{r.nome_autor || r.autor || "—"}</p><p className="text-[10px] text-muted-foreground">{r.tema_ia} · {r.localidade_gasto || r.uf || "local não informado"}</p>{r.resumo_ia && <p className="text-[10px] mt-1 line-clamp-2">{r.resumo_ia}</p>}</TableCell><TableCell className="min-w-[130px] text-xs"><p>Pag/Liq: <b>{pct(getPaid(r), r.valor_liquidado)}%</b></p><p>Pag/Emp: <b>{pct(getPaid(r), r.valor_empenhado)}%</b></p></TableCell><TableCell className="min-w-[150px] text-xs"><p>Emp. {brl(r.valor_empenhado)}</p><p>Liq. {brl(r.valor_liquidado)}</p><p className="text-governo font-bold">Pago {brl(getPaid(r))}</p></TableCell><TableCell><Badge variant={r.risco_execucao === "Alto" ? "destructive" : "outline"} className="text-[10px]">{r.risco_execucao}</Badge></TableCell><TableCell><a href={searchPortalUrl(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><ExternalLink size={12}/>Ver</a></TableCell></TableRow>)}</TableBody></Table></div></div>}</DialogContent></Dialog>
  </div>;
}
