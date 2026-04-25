import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ThumbsUp, ThumbsDown, Minus, Eye, ChevronLeft, ChevronRight, Search, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ReportEmailButton } from "@/components/ReportEmailButton";
import type { VotacaoCamara, VotacaoSenado } from "@/hooks/useInsightsData";
import { useVotacaoTemas } from "@/hooks/useVotacaoTemas";
import { TEMA_COLORS } from "@/components/insights/ThemeDistribution";

const CAMARA_COLOR = "hsl(239, 84%, 67%)";
const SENADO_COLOR = "hsl(160, 84%, 39%)";
const FAVOR_COLOR = "hsl(160, 84%, 39%)";
const CONTRA_COLOR = "hsl(347, 77%, 50%)";
const ABSTENCAO_COLOR = "hsl(45, 80%, 55%)";
const OUTROS_COLOR = "hsl(215, 16%, 47%)";
const CHART_COLORS = [
  "hsl(239, 84%, 67%)", "hsl(160, 84%, 39%)", "hsl(45, 80%, 55%)",
  "hsl(347, 77%, 50%)", "hsl(280, 60%, 55%)", "hsl(200, 70%, 50%)",
  "hsl(30, 80%, 55%)", "hsl(120, 50%, 45%)", "hsl(0, 60%, 50%)", "hsl(180, 60%, 40%)",
];

const VOTE_COLORS: Record<string, string> = {
  Sim: FAVOR_COLOR, Não: CONTRA_COLOR, Abstenção: ABSTENCAO_COLOR, Outros: OUTROS_COLOR,
};

const PAGE_SIZE = 30;
const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

interface Props {
  votacoesCamara: VotacaoCamara[];
  votacoesSenado: VotacaoSenado[];
  ano: number;
}

interface UnifiedProject {
  casa: "Câmara" | "Senado";
  tipo: string;
  numero: string;
  ementa: string;
  descricao: string;
  data: string | null;
  dataFormatted: string;
  resultado: string;
  idVotacao: string;
  orgao: string;
}

interface IndividualVote {
  nome: string;
  partido: string;
  uf: string;
  voto: string;
  votoClass: string;
  foto?: string;
}

interface VoteBreakdown {
  sim: number;
  nao: number;
  abstencao: number;
  outros: number;
  total: number;
  byParty: { partido: string; sim: number; nao: number; abstencao: number; total: number }[];
  orientacaoGoverno?: string;
  individualVotes: IndividualVote[];
}

function classifyVote(voto: string): "sim" | "nao" | "abstencao" | "outros" {
  const v = voto.toLowerCase().trim();
  if (v === "sim" || v === "favorável") return "sim";
  if (v === "não" || v === "nao" || v === "contrário" || v === "contrario") return "nao";
  if (v === "abstenção" || v === "abstencao" || v === "abstencão") return "abstencao";
  return "outros";
}

function classifyVoteLabel(cls: string): string {
  if (cls === "sim") return "Sim";
  if (cls === "nao") return "Não";
  if (cls === "abstencao") return "Abstenção";
  return "Outros";
}

export function ProjetosTab({ votacoesCamara, votacoesSenado, ano }: Props) {
  const [search, setSearch] = useState("");
  const [casaFilter, setCasaFilter] = useState<"all" | "camara" | "senado">("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [orgaoFilter, setOrgaoFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedProject, setSelectedProject] = useState<UnifiedProject | null>(null);
  const [voteBreakdown, setVoteBreakdown] = useState<VoteBreakdown | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [voteSearch, setVoteSearch] = useState("");

  const camaraTemas = useVotacaoTemas(ano, "camara");
  const senadoTemas = useVotacaoTemas(ano, "senado");

  const allProjects = useMemo<UnifiedProject[]>(() => {
    const cam = votacoesCamara.map((v): UnifiedProject => ({
      casa: "Câmara",
      tipo: v.proposicao_tipo || "Outros",
      numero: v.proposicao_numero || "—",
      ementa: v.proposicao_ementa || "—",
      descricao: v.descricao || "—",
      data: v.data,
      dataFormatted: v.data ? new Date(v.data).toLocaleDateString("pt-BR") : "—",
      resultado: "—",
      idVotacao: v.id_votacao,
      orgao: v.sigla_orgao || "—",
    }));
    const sen = votacoesSenado.map((v): UnifiedProject => ({
      casa: "Senado",
      tipo: v.sigla_materia || "Outros",
      numero: v.numero_materia || "—",
      ementa: v.ementa || "—",
      descricao: v.descricao || "—",
      data: v.data,
      dataFormatted: v.data ? new Date(v.data).toLocaleDateString("pt-BR") : "—",
      resultado: v.resultado || "—",
      idVotacao: v.codigo_sessao_votacao,
      orgao: "—",
    }));
    return [...cam, ...sen];
  }, [votacoesCamara, votacoesSenado]);

  const tipoOptions = useMemo(() => {
    const set = new Set(allProjects.map((p) => p.tipo));
    return Array.from(set).sort();
  }, [allProjects]);

  const orgaoOptions = useMemo(() => {
    const set = new Set(votacoesCamara.map((v) => v.sigla_orgao).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [votacoesCamara]);

  // Fixed search: combine all searchable fields into one string
  const filteredProjects = useMemo(() => {
    const term = search.toLowerCase().trim();
    return allProjects.filter((p) => {
      if (casaFilter !== "all" && p.casa.toLowerCase() !== (casaFilter === "camara" ? "câmara" : "senado")) return false;
      if (tipoFilter !== "all" && p.tipo !== tipoFilter) return false;
      if (orgaoFilter !== "all" && p.orgao !== orgaoFilter) return false;
      if (term) {
        const searchStr = `${p.tipo} ${p.numero} ${p.ementa} ${p.descricao} ${p.orgao}`.toLowerCase();
        if (!searchStr.includes(term)) return false;
      }
      return true;
    });
  }, [allProjects, search, casaFilter, tipoFilter, orgaoFilter]);

  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  const paginatedProjects = useMemo(() =>
    filteredProjects.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredProjects, page]
  );

  const handleFilterChange = useCallback((setter: (v: any) => void, value: any) => {
    setter(value);
    setPage(0);
  }, []);

  // Fetch votes on-demand from Câmara API when DB has no data
  const fetchCamaraApiVotes = useCallback(async (votacaoId: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/votacoes/${votacaoId}/votos`);
      if (!res.ok) return [];
      const json = await res.json();
      return json?.dados || [];
    } catch {
      return [];
    }
  }, []);

  const openProjectDetail = useCallback(async (project: UnifiedProject) => {
    setSelectedProject(project);
    setVoteBreakdown(null);
    setLoadingVotes(true);
    setVoteSearch("");

    try {
      if (project.casa === "Câmara") {
        const [votosRes, orientRes] = await Promise.all([
          supabase.from("votos_deputados").select("voto, deputado_id").eq("id_votacao", project.idVotacao).limit(1000),
          supabase.from("orientacoes").select("orientacao_voto, sigla_orgao_politico").eq("id_votacao", project.idVotacao),
        ]);

        let votosData = votosRes.data || [];
        let individualVotes: IndividualVote[] = [];

        if (votosData.length > 0) {
          // Get deputado info from analises
          const deputadoIds = votosData.map((v) => v.deputado_id);
          const analiseRes = await supabase
            .from("analises_deputados")
            .select("deputado_id, deputado_nome, deputado_partido, deputado_uf, deputado_foto")
            .eq("ano", ano)
            .in("deputado_id", deputadoIds.slice(0, 500));

          const depMap: Record<number, { nome: string; partido: string; uf: string; foto: string }> = {};
          (analiseRes.data || []).forEach((a) => {
            depMap[a.deputado_id] = {
              nome: a.deputado_nome,
              partido: a.deputado_partido || "Sem Partido",
              uf: a.deputado_uf || "",
              foto: a.deputado_foto || "",
            };
          });

          individualVotes = votosData.map((v) => {
            const dep = depMap[v.deputado_id];
            const cls = classifyVote(v.voto);
            return {
              nome: dep?.nome || `Dep. ${v.deputado_id}`,
              partido: dep?.partido || "Sem Partido",
              uf: dep?.uf || "",
              voto: v.voto,
              votoClass: classifyVoteLabel(cls),
              foto: dep?.foto,
            };
          });
        } else {
          // Fallback: fetch from Câmara API
          const apiVotos = await fetchCamaraApiVotes(project.idVotacao);
          individualVotes = apiVotos.map((v: any) => {
            const cls = classifyVote(v.tipoVoto || "");
            return {
              nome: v.deputado_?.nome || "N/A",
              partido: v.deputado_?.siglaPartido || "Sem Partido",
              uf: v.deputado_?.siglaUf || "",
              voto: v.tipoVoto || "",
              votoClass: classifyVoteLabel(cls),
              foto: v.deputado_?.urlFoto || "",
            };
          });
        }

        const breakdown = buildBreakdown(
          individualVotes.map((v) => ({ voto: v.voto, partido: v.partido })),
          individualVotes
        );

        const govOrient = (orientRes.data || []).find((o) =>
          ["GOV.", "GOVERNO", "LIDGOV", "Gov.", "Governo"].includes(o.sigla_orgao_politico)
        );
        breakdown.orientacaoGoverno = govOrient?.orientacao_voto || "Não disponível";

        setVoteBreakdown(breakdown);
      } else {
        // Senado
        const votosRes = await supabase
          .from("votos_senadores")
          .select("voto, senador_id")
          .eq("codigo_sessao_votacao", project.idVotacao)
          .limit(500);

        const votosData = votosRes.data || [];
        let individualVotes: IndividualVote[] = [];

        if (votosData.length > 0) {
          const senadorIds = votosData.map((v) => v.senador_id);
          const analiseRes = await supabase
            .from("analises_senadores")
            .select("senador_id, senador_nome, senador_partido, senador_uf, senador_foto")
            .eq("ano", ano)
            .in("senador_id", senadorIds.slice(0, 500));

          const senMap: Record<number, { nome: string; partido: string; uf: string; foto: string }> = {};
          (analiseRes.data || []).forEach((a) => {
            senMap[a.senador_id] = {
              nome: a.senador_nome,
              partido: a.senador_partido || "Sem Partido",
              uf: a.senador_uf || "",
              foto: a.senador_foto || "",
            };
          });

          individualVotes = votosData.map((v) => {
            const sen = senMap[v.senador_id];
            const cls = classifyVote(v.voto);
            return {
              nome: sen?.nome || `Sen. ${v.senador_id}`,
              partido: sen?.partido || "Sem Partido",
              uf: sen?.uf || "",
              voto: v.voto,
              votoClass: classifyVoteLabel(cls),
              foto: sen?.foto,
            };
          });
        }

        const breakdown = buildBreakdown(
          individualVotes.map((v) => ({ voto: v.voto, partido: v.partido })),
          individualVotes
        );
        setVoteBreakdown(breakdown);
      }
    } catch (err) {
      console.error("Error fetching votes:", err);
    } finally {
      setLoadingVotes(false);
    }
  }, [ano, fetchCamaraApiVotes]);

  // Filtered individual votes for the dialog
  const filteredVotes = useMemo(() => {
    if (!voteBreakdown) return [];
    const term = voteSearch.toLowerCase().trim();
    if (!term) return voteBreakdown.individualVotes;
    return voteBreakdown.individualVotes.filter((v) =>
      `${v.nome} ${v.partido} ${v.uf} ${v.votoClass}`.toLowerCase().includes(term)
    );
  }, [voteBreakdown, voteSearch]);

  // Charts data
  const tiposCamara = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesCamara.forEach((v) => { map[v.proposicao_tipo || "Outros"] = (map[v.proposicao_tipo || "Outros"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [votacoesCamara]);

  const tiposSenado = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesSenado.forEach((v) => { map[v.sigla_materia || "Outros"] = (map[v.sigla_materia || "Outros"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [votacoesSenado]);

  const resultadosSenado = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesSenado.forEach((v) => { map[v.resultado || "Sem resultado"] = (map[v.resultado || "Sem resultado"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [votacoesSenado]);

  const timeline = useMemo(() => {
    const months: Record<string, { camara: number; senado: number }> = {};
    const add = (d: string | null, c: "camara" | "senado") => { if (!d) return; const m = d.substring(0, 7); months[m] = months[m] || { camara: 0, senado: 0 }; months[m][c]++; };
    votacoesCamara.forEach((v) => add(v.data, "camara"));
    votacoesSenado.forEach((v) => add(v.data, "senado"));
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, ...v }));
  }, [votacoesCamara, votacoesSenado]);

  const orgaosCamara = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesCamara.forEach((v) => { map[v.sigla_orgao || "Desc."] = (map[v.sigla_orgao || "Desc."] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [votacoesCamara]);

  const executive = useMemo(() => {
    const votados = allProjects.filter((p) => p.data);
    const aprovados = allProjects.filter((p) => /aprov|sim|favor/i.test(`${p.resultado} ${p.descricao}`));
    const rejeitados = allProjects.filter((p) => /rejeit|não|nao|contr/i.test(`${p.resultado} ${p.descricao}`));
    const pautados = allProjects.filter((p) => /pauta|ordem do dia|plen|sessão|sessao|delibera/i.test(`${p.descricao} ${p.orgao}`));
    const recentes = [...votados].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).slice(0, 6);
    const progresso = allProjects.length ? Math.round((votados.length / allProjects.length) * 100) : 0;
    return { votados, aprovados, rejeitados, pautados, recentes, progresso };
  }, [allProjects]);

  const plenaryReadiness = useMemo(() => {
    const scoreProject = (p: UnifiedProject) => {
      const text = `${p.tipo} ${p.numero} ${p.ementa} ${p.descricao} ${p.orgao} ${p.resultado}`.toLowerCase();
      let score = 25;
      if (/comiss|relator|parecer|ccj|cft|ce|cas|cae/.test(text)) score = 45;
      if (/pronta|pronto|pauta|ordem do dia|delibera|plen/.test(text)) score = 72;
      if (p.data || /vota|aprov|rejeit/.test(text)) score = 90;
      if (/sanção|sancao|promulg|lei /.test(text)) score = 100;
      return score;
    };
    const labelFor = (score: number) => {
      if (score >= 100) return "Sanção/lei";
      if (score >= 90) return "Já votada";
      if (score >= 72) return "Pronta para plenário";
      if (score >= 45) return "Em comissão";
      return "Inicial";
    };

    const enriched = allProjects.map((p) => {
      const score = scoreProject(p);
      return { ...p, score, etapa: labelFor(score), tema: p.casa === "Câmara" ? camaraTemas.temaMap.get(p.idVotacao) : senadoTemas.temaMap.get(p.idVotacao) };
    });

    const advanced = enriched
      .filter((p) => p.score >= 72)
      .sort((a, b) => b.score - a.score || String(b.data || "").localeCompare(String(a.data || "")))
      .slice(0, 8);

    const voted = enriched
      .filter((p) => p.score >= 90)
      .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))
      .slice(0, 8);

    const byStage = ["Inicial", "Em comissão", "Pronta para plenário", "Já votada", "Sanção/lei"].map((etapa) => ({
      etapa,
      quantidade: enriched.filter((p) => p.etapa === etapa).length,
    }));

    const byTheme: Record<string, { tema: string; prontas: number; votadas: number }> = {};
    enriched.forEach((p) => {
      const tema = p.tema || "Sem tema";
      byTheme[tema] = byTheme[tema] || { tema, prontas: 0, votadas: 0 };
      if (p.score >= 72 && p.score < 90) byTheme[tema].prontas += 1;
      if (p.score >= 90) byTheme[tema].votadas += 1;
    });

    return {
      advanced,
      voted,
      byStage,
      byTheme: Object.values(byTheme).sort((a, b) => (b.prontas + b.votadas) - (a.prontas + a.votadas)).slice(0, 10),
    };
  }, [allProjects, camaraTemas.temaMap, senadoTemas.temaMap]);

  const projectStatus = (p: UnifiedProject) => {
    const text = `${p.resultado} ${p.descricao}`.toLowerCase();
    if (/aprov|sim|favor/.test(text)) return { label: "Aprovado", cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" };
    if (/rejeit|não|nao|contr/.test(text)) return { label: "Rejeitado", cls: "bg-rose-500/20 text-rose-700 dark:text-rose-300" };
    if (p.data) return { label: "Votado", cls: "bg-blue-500/20 text-blue-700 dark:text-blue-300" };
    return { label: "Sem resultado", cls: "bg-muted text-muted-foreground" };
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black" style={{ color: CAMARA_COLOR }}>{votacoesCamara.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Votações Câmara</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black" style={{ color: SENADO_COLOR }}>{votacoesSenado.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Votações Senado</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black text-foreground">{filteredProjects.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Resultados Filtrados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black text-foreground">{tiposCamara.length + tiposSenado.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Tipos Distintos</p>
        </CardContent></Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} className="text-primary" /> Leitura executiva da tramitação legislativa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p className="text-2xl font-black text-primary">{executive.votados.length}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Projetos votados</p></div>
            <div><p className="text-2xl font-black">{executive.pautados.length}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Pautados/plenário</p></div>
            <div><p className="text-2xl font-black text-governo">{executive.aprovados.length}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Aprovados</p></div>
            <div><p className="text-2xl font-black text-oposicao">{executive.rejeitados.length}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">Rejeitados</p></div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs"><span className="font-bold text-muted-foreground uppercase">Proporção votada no universo carregado</span><span className="font-black">{executive.progresso}%</span></div>
            <Progress value={executive.progresso} className="h-2" />
          </div>
          {executive.recentes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {executive.recentes.map((p, i) => { const st = projectStatus(p); return (
                <button key={`${p.idVotacao}-recent-${i}`} onClick={() => openProjectDetail(p)} className="text-left rounded-md border border-border bg-background/60 p-2 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-1 mb-1"><Badge variant="outline" className="text-[9px]">{p.casa}</Badge><Badge className={`text-[9px] border-0 ${st.cls}`}>{st.label}</Badge></div>
                  <p className="text-xs font-bold truncate">{p.tipo} {p.numero}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{p.ementa !== "—" ? p.ementa : p.descricao}</p>
                </button>
              ); })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tipo de Proposição — Câmara</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tiposCamara} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis /><Tooltip />
                <Bar dataKey="value" name="Qtd" fill={CAMARA_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tipo de Matéria — Senado</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tiposSenado} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis /><Tooltip />
                <Bar dataKey="value" name="Qtd" fill={SENADO_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resultados — Senado</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={resultadosSenado} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={95}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {resultadosSenado.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Volume Mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend />
                <Line type="monotone" dataKey="camara" name="Câmara" stroke={CAMARA_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="senado" name="Senado" stroke={SENADO_COLOR} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Órgãos */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Órgãos Mais Ativos — Câmara</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(250, orgaosCamara.length * 30)}>
            <BarChart data={orgaosCamara} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" name="Votações" fill={CAMARA_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filterable Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projetos Votados</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="relative flex-1 min-w-[180px] max-w-[260px]">
              <Search className="absolute left-2.5 top-2 text-muted-foreground" size={14} />
              <Input
                placeholder="Buscar: PL 1234, ementa..."
                value={search}
                onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                className="pl-8 text-sm h-8"
                inputMode="search"
              />
            </div>
            <Select value={casaFilter} onValueChange={(v) => handleFilterChange(setCasaFilter, v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Casa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="camara">Câmara</SelectItem>
                <SelectItem value="senado">Senado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={(v) => handleFilterChange(setTipoFilter, v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tipoOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {casaFilter !== "senado" && (
              <Select value={orgaoFilter} onValueChange={(v) => handleFilterChange(setOrgaoFilter, v)}>
                <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Órgão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {orgaoOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Casa</TableHead>
                  <TableHead className="w-16">Tipo</TableHead>
                  <TableHead className="w-14">Nº</TableHead>
                  <TableHead>Ementa / Descrição</TableHead>
                  <TableHead className="w-24">Data</TableHead>
                  <TableHead className="w-24">Resultado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProjects.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum projeto encontrado</TableCell></TableRow>
                ) : paginatedProjects.map((p, i) => (
                  <TableRow key={`${p.idVotacao}-${i}`} className="cursor-pointer hover:bg-accent/50" onClick={() => openProjectDetail(p)}>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] px-1.5" style={{
                        backgroundColor: p.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR,
                        color: "#fff", border: "none",
                      }}>{p.casa === "Câmara" ? "CÂM" : "SEN"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{p.tipo}</TableCell>
                    <TableCell className="text-xs">{p.numero}</TableCell>
                    <TableCell className="text-xs max-w-[350px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate" title={p.ementa !== "—" ? p.ementa : p.descricao}>
                          {p.ementa !== "—" ? p.ementa : p.descricao}
                        </span>
                        {(() => {
                          const tema = p.casa === "Câmara" ? camaraTemas.temaMap.get(p.idVotacao) : senadoTemas.temaMap.get(p.idVotacao);
                          if (!tema) return null;
                          return (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-none" style={{
                              backgroundColor: `${TEMA_COLORS[tema] || "#999"}20`,
                              color: TEMA_COLORS[tema] || "#999",
                            }}>{tema}</Badge>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{p.dataFormatted}</TableCell>
                    <TableCell className="text-xs"><Badge className={`text-[9px] border-0 ${projectStatus(p).cls}`}>{projectStatus(p).label}</Badge></TableCell>
                    <TableCell><Eye size={14} className="text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                {filteredProjects.length} projetos — Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={14} />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={(open) => { if (!open) { setSelectedProject(null); setVoteSearch(""); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge style={{
                    backgroundColor: selectedProject.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR,
                    color: "#fff", border: "none",
                  }}>{selectedProject.casa}</Badge>
                  <Badge variant="outline">{selectedProject.tipo} {selectedProject.numero}</Badge>
                  <span className="text-xs text-muted-foreground">{selectedProject.dataFormatted}</span>
                </div>
                <DialogTitle className="text-base mt-2 leading-relaxed">
                  {selectedProject.ementa !== "—" ? selectedProject.ementa : selectedProject.descricao}
                </DialogTitle>
                {selectedProject.ementa !== "—" && selectedProject.descricao !== "—" && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedProject.descricao}</p>
                )}
                {selectedProject.resultado !== "—" && (
                  <Badge variant="secondary" className="mt-1 w-fit">{selectedProject.resultado}</Badge>
                )}
                {selectedProject.orgao !== "—" && (
                  <p className="text-xs text-muted-foreground">Órgão: {selectedProject.orgao}</p>
                )}
                <div className="pt-2">
                  <ReportEmailButton report={{
                    title: `${selectedProject.tipo} ${selectedProject.numero} — ${selectedProject.casa}`,
                    summary: selectedProject.ementa !== "—" ? selectedProject.ementa : selectedProject.descricao,
                    sections: [
                      `Data: ${selectedProject.dataFormatted}.`,
                      `Resultado/status: ${projectStatus(selectedProject).label}.`,
                      `Órgão: ${selectedProject.orgao}.`,
                    ],
                  }} />
                </div>
              </DialogHeader>

              {loadingVotes ? (
                <div className="space-y-3 mt-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-60 w-full" />
                </div>
              ) : voteBreakdown ? (
                <div className="space-y-4 mt-4">
                  {voteBreakdown.orientacaoGoverno && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Orientação do Governo:</span>
                      <Badge variant="outline" className="text-xs">{voteBreakdown.orientacaoGoverno}</Badge>
                    </div>
                  )}

                  {/* Vote summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                      <ThumbsUp size={16} style={{ color: FAVOR_COLOR }} />
                      <div>
                        <p className="text-lg font-black" style={{ color: FAVOR_COLOR }}>{voteBreakdown.sim}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Sim</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                      <ThumbsDown size={16} style={{ color: CONTRA_COLOR }} />
                      <div>
                        <p className="text-lg font-black" style={{ color: CONTRA_COLOR }}>{voteBreakdown.nao}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Não</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                      <Minus size={16} style={{ color: ABSTENCAO_COLOR }} />
                      <div>
                        <p className="text-lg font-black" style={{ color: ABSTENCAO_COLOR }}>{voteBreakdown.abstencao}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Abstenção</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                      <Eye size={16} style={{ color: OUTROS_COLOR }} />
                      <div>
                        <p className="text-lg font-black text-foreground">{voteBreakdown.total}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Pie chart - map colors by category name */}
                  {(() => {
                    const pieData = [
                      { name: "Sim", value: voteBreakdown.sim },
                      { name: "Não", value: voteBreakdown.nao },
                      { name: "Abstenção", value: voteBreakdown.abstencao },
                      { name: "Outros", value: voteBreakdown.outros },
                    ].filter((d) => d.value > 0);

                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={VOTE_COLORS[entry.name] || OUTROS_COLOR} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}

                  {/* By party */}
                  {voteBreakdown.byParty.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">Votos por Partido</h4>
                      <div className="max-h-[250px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Partido</TableHead>
                              <TableHead className="text-xs text-center" style={{ color: FAVOR_COLOR }}>Sim</TableHead>
                              <TableHead className="text-xs text-center" style={{ color: CONTRA_COLOR }}>Não</TableHead>
                              <TableHead className="text-xs text-center" style={{ color: ABSTENCAO_COLOR }}>Abst.</TableHead>
                              <TableHead className="text-xs text-center">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {voteBreakdown.byParty.map((bp) => (
                              <TableRow key={bp.partido}>
                                <TableCell className="text-xs font-medium">{bp.partido}</TableCell>
                                <TableCell className="text-xs text-center font-semibold" style={{ color: FAVOR_COLOR }}>{bp.sim}</TableCell>
                                <TableCell className="text-xs text-center font-semibold" style={{ color: CONTRA_COLOR }}>{bp.nao}</TableCell>
                                <TableCell className="text-xs text-center font-semibold" style={{ color: ABSTENCAO_COLOR }}>{bp.abstencao}</TableCell>
                                <TableCell className="text-xs text-center">{bp.total}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Individual parliamentarian votes */}
                  {voteBreakdown.individualVotes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Users size={14} /> Votos Individuais ({voteBreakdown.individualVotes.length})
                        </h4>
                      </div>
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-2 text-muted-foreground" size={14} />
                        <Input
                          placeholder="Buscar parlamentar, partido, UF..."
                          value={voteSearch}
                          onChange={(e) => setVoteSearch(e.target.value)}
                          className="pl-8 text-sm h-8"
                          inputMode="search"
                        />
                      </div>
                      <div className="max-h-[350px] overflow-auto border border-border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Parlamentar</TableHead>
                              <TableHead className="text-xs">Partido</TableHead>
                              <TableHead className="text-xs">UF</TableHead>
                              <TableHead className="text-xs text-center">Voto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredVotes.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">
                                  Nenhum resultado
                                </TableCell>
                              </TableRow>
                            ) : filteredVotes.map((v, i) => (
                              <TableRow key={`${v.nome}-${i}`}>
                                <TableCell className="text-xs font-medium">
                                  <div className="flex items-center gap-2">
                                    {v.foto && (
                                      <img src={v.foto} alt="" className="w-6 h-6 rounded-full object-cover" />
                                    )}
                                    {v.nome}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">{v.partido}</TableCell>
                                <TableCell className="text-xs">{v.uf}</TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                    style={{
                                      backgroundColor: VOTE_COLORS[v.votoClass] || OUTROS_COLOR,
                                      color: "#fff",
                                      border: "none",
                                    }}
                                  >
                                    {v.votoClass}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">Não foi possível carregar os votos.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildBreakdown(
  votos: { voto: string; partido: string }[],
  individualVotes: IndividualVote[] = []
): VoteBreakdown {
  let sim = 0, nao = 0, abstencao = 0, outros = 0;
  const partyMap: Record<string, { sim: number; nao: number; abstencao: number; outros: number; total: number }> = {};

  votos.forEach(({ voto, partido }) => {
    const cls = classifyVote(voto);
    if (cls === "sim") sim++;
    else if (cls === "nao") nao++;
    else if (cls === "abstencao") abstencao++;
    else outros++;

    if (!partyMap[partido]) partyMap[partido] = { sim: 0, nao: 0, abstencao: 0, outros: 0, total: 0 };
    if (cls === "sim") partyMap[partido].sim++;
    else if (cls === "nao") partyMap[partido].nao++;
    else if (cls === "abstencao") partyMap[partido].abstencao++;
    else partyMap[partido].outros++;
    partyMap[partido].total++;
  });

  const byParty = Object.entries(partyMap)
    .map(([partido, v]) => ({ partido, sim: v.sim, nao: v.nao, abstencao: v.abstencao, total: v.total }))
    .sort((a, b) => b.total - a.total);

  return { sim, nao, abstencao, outros, total: votos.length, byParty, individualVotes };
}
