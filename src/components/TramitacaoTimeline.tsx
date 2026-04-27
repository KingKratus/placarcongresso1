import { useEffect, useMemo, useState } from "react";
import { Loader2, Calendar, Building2, FileText, AlertCircle, RefreshCw, ExternalLink, Search, CheckCircle2, Gavel, Landmark, Archive, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportEmailButton } from "@/components/ReportEmailButton";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Evento {
  data: string | null;
  descricao: string;
  situacao: string | null;
  orgao: string | null;
  despacho: string | null;
}

interface Tramitacao {
  casa: "camara" | "senado";
  tipo: string;
  numero: string;
  ano: number;
  ementa: string | null;
  ultima_situacao: string | null;
  ultima_atualizacao: string | null;
  proposicao_id_externo: string | null;
  eventos: Evento[];
}

interface Props {
  casa: "camara" | "senado";
  tipo: string;
  numero: string;
  ano: number;
}

type EventKind = "todos" | "comissao" | "plenario" | "sancao" | "mesa" | "arquivamento" | "outros";

const KIND_LABELS: Record<EventKind, string> = {
  todos: "Todos",
  comissao: "Comissão",
  plenario: "Plenário",
  sancao: "Sanção",
  mesa: "Mesa",
  arquivamento: "Encerramento",
  outros: "Outros",
};

function statusVariant(situacao: string | null): { color: string; label: string } {
  if (!situacao) return { color: "bg-muted text-muted-foreground", label: "Sem status" };
  const s = situacao.toLowerCase();
  if (s.includes("aprovad") || s.includes("sancionad") || s.includes("promulgad") || s.includes("transformad"))
    return { color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300", label: situacao };
  if (s.includes("arquiv") || s.includes("rejeit") || s.includes("retirad"))
    return { color: "bg-rose-500/20 text-rose-700 dark:text-rose-300", label: situacao };
  if (s.includes("comiss") || s.includes("relator"))
    return { color: "bg-amber-500/20 text-amber-700 dark:text-amber-300", label: situacao };
  return { color: "bg-blue-500/20 text-blue-700 dark:text-blue-300", label: situacao };
}

function eventText(ev: Evento) {
  return `${ev.descricao || ""} ${ev.situacao || ""} ${ev.orgao || ""} ${ev.despacho || ""}`.toLowerCase();
}

function classifyEvent(ev: Evento): EventKind {
  const t = eventText(ev);
  if (t.includes("sanç") || t.includes("sancion") || t.includes("presidência da república") || t.includes("promulg")) return "sancao";
  if (t.includes("plen") || t.includes("ordem do dia") || t.includes("pauta") || t.includes("votaç") || t.includes("votad")) return "plenario";
  if (t.includes("comiss") || t.includes("ccj") || t.includes("relator") || t.includes("parecer")) return "comissao";
  if (t.includes("mesa") || t.includes("diretora") || t.includes("presidência") || t.includes("secretaria")) return "mesa";
  if (t.includes("arquiv") || t.includes("rejeit") || t.includes("retirad") || t.includes("prejudicad")) return "arquivamento";
  return "outros";
}

function buildInsights(eventos: Evento[], ultima: string | null) {
  const allText = `${eventos.map(eventText).join(" ")} ${ultima || ""}`.toLowerCase();
  const hasComissao = eventos.some((e) => classifyEvent(e) === "comissao");
  const hasPlenario = eventos.some((e) => classifyEvent(e) === "plenario");
  const hasSancao = eventos.some((e) => classifyEvent(e) === "sancao");
  const encerrado = /arquiv|rejeit|retirad|prejudicad/.test(allText);
  const aprovado = /aprovad|sancion|promulg|transformad/.test(allText);
  const votado = /votaç|votad|aprovad|rejeit/.test(allText);
  let progress = 20;
  let etapa = "Apresentação";
  if (hasComissao) { progress = 40; etapa = "Comissões"; }
  if (hasPlenario || votado) { progress = 65; etapa = "Plenário/pauta"; }
  if (aprovado) { progress = 82; etapa = "Aprovado / revisão"; }
  if (hasSancao) { progress = 100; etapa = "Sanção ou promulgação"; }
  if (encerrado && !hasSancao) { progress = Math.max(progress, 90); etapa = "Encerrado"; }
  const eventCounts = Object.keys(KIND_LABELS).filter((k) => k !== "todos").map((k) => ({ tipo: KIND_LABELS[k as EventKind], quantidade: eventos.filter((e) => classifyEvent(e) === k).length }));
  const monthMap: Record<string, number> = {};
  eventos.forEach((e) => { if (!e.data) return; const m = e.data.slice(0, 7); monthMap[m] = (monthMap[m] || 0) + 1; });
  const timeline = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([mes, quantidade]) => ({ mes, quantidade }));
  const orgaos = [...new Set(eventos.map((e) => e.orgao).filter(Boolean))] as string[];
  const decisivos = eventos.filter((e) => /aprov|rejeit|votaç|votad|pauta|ordem do dia|sanç|sancion|promulg|arquiv|parecer/i.test(eventText(e)));
  const lastDate = eventos.map((e) => e.data).filter(Boolean).sort().at(-1);
  const diasSemMovimento = lastDate ? Math.max(0, Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)) : null;
  const marcos = [
    { label: "Apresentação", done: eventos.length > 0 },
    { label: "Comissão", done: hasComissao },
    { label: "Parecer", done: /parecer|relator/i.test(allText) },
    { label: "Pauta/plenário", done: hasPlenario },
    { label: "Votação", done: votado },
    { label: "Sanção", done: hasSancao },
  ];
  return { hasComissao, hasPlenario, hasSancao, encerrado, aprovado, votado, progress, etapa, eventCounts, timeline, orgaos, decisivos, diasSemMovimento, marcos };
}

export function TramitacaoTimeline({ casa, tipo, numero, ano }: Props) {
  const [data, setData] = useState<Tramitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState<EventKind>("todos");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"todos" | "decisivos" | "recentes">("todos");

  const load = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-tramitacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ casa, tipo, numero, ano, force }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Erro ao buscar tramitação");
      setData(json.tramitacao);
    } catch (e: any) {
      setError(e.message || "Erro de conexão");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [casa, tipo, numero, ano]);

  const filteredEventos = useMemo(() => {
    const term = search.toLowerCase().trim();
    const insights = buildInsights(data?.eventos || [], data?.ultima_situacao || null);
    const recentSet = new Set((data?.eventos || []).slice(-10));
    const decisiveSet = new Set(insights.decisivos);
    return (data?.eventos || []).filter((ev) => {
      if (scope === "decisivos" && !decisiveSet.has(ev)) return false;
      if (scope === "recentes" && !recentSet.has(ev)) return false;
      if (kind !== "todos" && classifyEvent(ev) !== kind) return false;
      if (term && !eventText(ev).includes(term)) return false;
      return true;
    });
  }, [data?.eventos, data?.ultima_situacao, kind, search, scope]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin mr-2" size={18} /><span className="text-sm text-muted-foreground">Carregando tramitação…</span></div>;
  if (error) return <div className="py-8 text-center space-y-3"><AlertCircle className="mx-auto text-destructive" size={28} /><p className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => load(true)}>Tentar novamente</Button></div>;
  if (!data) return null;

  const { ementa, ultima_situacao, ultima_atualizacao, eventos, proposicao_id_externo } = data;
  const status = statusVariant(ultima_situacao);
  const insights = buildInsights(eventos, ultima_situacao);
  const externalUrl = casa === "camara" ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${proposicao_id_externo}` : `https://www25.senado.leg.br/web/atividade/materias/-/materia/${proposicao_id_externo}`;
  const report = {
    title: `Tramitação ${tipo} ${numero}/${ano}`,
    summary: `${ementa || "Proposição legislativa"}. Etapa atual: ${insights.etapa}; progresso estimado: ${insights.progress}%; ${filteredEventos.length} de ${eventos.length} eventos exibidos.`,
    sections: [
      `Status oficial: ${ultima_situacao || "sem status"}.`,
      `Comissão: ${insights.hasComissao ? "sim" : "não"}; Plenário/pauta: ${insights.hasPlenario ? "sim" : "não"}; Votado: ${insights.votado ? "sim" : "não"}; Sanção: ${insights.hasSancao ? "sim" : "não"}.`,
      `Última atualização: ${ultima_atualizacao ? new Date(ultima_atualizacao).toLocaleDateString("pt-BR") : "não informada"}.`,
    ],
    url: externalUrl,
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-primary">{tipo} {numero}/{ano}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{casa === "camara" ? "Câmara" : "Senado"}</p>
          </div>
          <div className="flex items-center gap-1">
            <ReportEmailButton report={report} size="sm" />
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={refreshing} onClick={() => load(true)} title="Atualizar"><RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /></Button>
          </div>
        </div>
        {ementa && <p className="text-xs text-foreground line-clamp-3">{ementa}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge className={`text-[9px] px-1.5 py-0 border-0 ${status.color}`}>{status.label}</Badge>
          {ultima_atualizacao && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar size={10} />{new Date(ultima_atualizacao).toLocaleDateString("pt-BR")}</span>}
          {proposicao_id_externo && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 ml-auto">Ficha oficial <ExternalLink size={10} /></a>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Progresso legislativo</p><p className="text-sm font-bold">{insights.etapa}</p></div><p className="text-2xl font-black text-primary">{insights.progress}%</p></div>
        <Progress value={insights.progress} className="h-2" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Badge variant="outline" className="justify-center gap-1"><Building2 size={11} /> Comissão: {insights.hasComissao ? "sim" : "não"}</Badge>
          <Badge variant="outline" className="justify-center gap-1"><Gavel size={11} /> Pautado: {insights.hasPlenario ? "sim" : "não"}</Badge>
          <Badge variant="outline" className="justify-center gap-1"><CheckCircle2 size={11} /> Votado: {insights.votado ? "sim" : "não"}</Badge>
          <Badge variant="outline" className="justify-center gap-1"><Flag size={11} /> Sanção: {insights.hasSancao ? "sim" : "não"}</Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar texto da tramitação" className="pl-8 h-9 text-xs" /></div>
        <Select value={kind} onValueChange={(v) => setKind(v as EventKind)}><SelectTrigger className="h-9 text-xs sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(KIND_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent></Select>
        {(kind !== "todos" || search) && <Button variant="ghost" size="sm" onClick={() => { setKind("todos"); setSearch(""); }}>Limpar</Button>}
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{filteredEventos.length} de {eventos.length} eventos exibidos</p>
        {filteredEventos.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-2 opacity-50" size={28} />Nenhum evento com estes filtros.</div> : (
          <ScrollArea className="h-[60vh] pr-3">
            <ol className="relative border-l-2 border-border ml-2 space-y-3">
              {[...filteredEventos].reverse().map((ev, i) => {
                const sv = statusVariant(ev.situacao);
                const evKind = classifyEvent(ev);
                return <li key={i} className="ml-4 pb-1"><div className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" /><div className="rounded-md border border-border bg-card/60 p-2.5 space-y-1.5"><div className="flex items-center justify-between gap-2 flex-wrap"><span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Calendar size={10} />{ev.data ? new Date(ev.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>{ev.orgao && <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1"><Landmark size={9} /> {ev.orgao}</span>}</div><div className="flex flex-wrap gap-1"><Badge variant="secondary" className="text-[8px] px-1.5 py-0">{KIND_LABELS[evKind]}</Badge>{ev.situacao && <Badge className={`text-[8px] px-1.5 py-0 border-0 ${sv.color}`}>{ev.situacao}</Badge>}</div><p className="text-xs text-foreground">{ev.descricao}</p>{ev.despacho && ev.despacho !== ev.descricao && <p className="text-[10px] text-muted-foreground italic">{ev.despacho}</p>}</div></li>;
              })}
            </ol>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
