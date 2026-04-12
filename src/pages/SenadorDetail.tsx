import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  UserMinus,
  BarChart2,
  Vote,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Analise = Tables<"analises_senadores">;
type VotoSenador = Tables<"votos_senadores">;
type VotacaoSenado = Tables<"votacoes_senado">;
type VotacaoTema = Tables<"votacao_temas">;

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
};

const classConfig: Record<string, { color: string; icon: any; bg: string }> = {
  Governo: { color: "text-governo", icon: UserCheck, bg: "bg-governo/10" },
  Centro: { color: "text-centro", icon: UserMinus, bg: "bg-centro/10" },
  Oposição: { color: "text-oposicao", icon: UserX, bg: "bg-oposicao/10" },
  "Sem Dados": { color: "text-muted-foreground", icon: BarChart2, bg: "bg-muted" },
};

const ITEMS_PER_PAGE = 20;

function normalizeVotoLabel(voto: string): string {
  const v = voto.trim().toLowerCase();
  if (v === "sim" || v === "yes") return "sim";
  if (v === "não" || v === "nao" || v === "no") return "não";
  return v;
}

async function fetchAllVotos(senId: number): Promise<VotoSenador[]> {
  const all: VotoSenador[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("votos_senadores")
      .select("*")
      .eq("senador_id", senId)
      .order("codigo_sessao_votacao", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export default function SenadorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const senId = Number(id);

  const [analises, setAnalises] = useState<Analise[]>([]);
  const [votos, setVotos] = useState<VotoSenador[]>([]);
  const [votacoes, setVotacoes] = useState<VotacaoSenado[]>([]);
  const [temas, setTemas] = useState<VotacaoTema[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [yearFilter, setYearFilter] = useState("all");
  const [voteTypeFilter, setVoteTypeFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!senId) return;
    setLoading(true);

    const loadData = async () => {
      const [analiseRes, votosData] = await Promise.all([
        supabase
          .from("analises_senadores")
          .select("*")
          .eq("senador_id", senId)
          .order("ano", { ascending: true }),
        fetchAllVotos(senId),
      ]);

      const analiseData = analiseRes.data || [];
      setAnalises(analiseData);
      setVotos(votosData);

      const votacaoCodigos = [...new Set(votosData.map((v) => v.codigo_sessao_votacao))];
      if (votacaoCodigos.length > 0) {
        const allVotacoes: VotacaoSenado[] = [];
        for (let i = 0; i < votacaoCodigos.length; i += 100) {
          const batch = votacaoCodigos.slice(i, i + 100);
          const { data } = await supabase
            .from("votacoes_senado")
            .select("*")
            .in("codigo_sessao_votacao", batch);
          if (data) allVotacoes.push(...data);
        }
        setVotacoes(allVotacoes);
      }

      setLoading(false);
    };

    loadData();
  }, [senId]);

  const currentAnalise = analises.length > 0 ? analises[analises.length - 1] : null;
  const cfg = currentAnalise
    ? classConfig[currentAnalise.classificacao] || classConfig["Sem Dados"]
    : classConfig["Sem Dados"];
  const Icon = cfg.icon;

  const evolutionData = analises.map((a) => ({
    ano: a.ano,
    score: Number(a.score),
    classificacao: a.classificacao,
  }));

  const votacaoMap = useMemo(() => {
    const m: Record<string, VotacaoSenado> = {};
    votacoes.forEach((v) => (m[v.codigo_sessao_votacao] = v));
    return m;
  }, [votacoes]);

  const filteredVotos = useMemo(() => {
    return votos.filter((v) => {
      if (yearFilter !== "all" && v.ano !== Number(yearFilter)) return false;

      if (voteTypeFilter !== "all") {
        const norm = normalizeVotoLabel(v.voto);
        if (voteTypeFilter === "sim" && norm !== "sim") return false;
        if (voteTypeFilter === "nao" && norm !== "não") return false;
      }

      if (searchText.trim()) {
        const votacao = votacaoMap[v.codigo_sessao_votacao];
        const haystack = [
          votacao?.ementa,
          votacao?.descricao,
          votacao?.sigla_materia,
          votacao?.numero_materia,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchText.trim().toLowerCase())) return false;
      }

      return true;
    });
  }, [votos, yearFilter, voteTypeFilter, searchText, votacaoMap]);

  useEffect(() => {
    setPage(0);
  }, [yearFilter, voteTypeFilter, searchText]);

  const totalPages = Math.ceil(filteredVotos.length / ITEMS_PER_PAGE);
  const paginatedVotos = filteredVotos.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const availableYears = useMemo(() => {
    return [...new Set(votos.map((v) => v.ano))].sort((a, b) => b - a);
  }, [votos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-bold text-sm uppercase tracking-widest">
          Carregando...
        </div>
      </div>
    );
  }

  if (!currentAnalise) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Button variant="ghost" onClick={() => navigate("/senado")} className="gap-2 mb-6">
          <ArrowLeft size={16} /> Voltar
        </Button>
        <p className="text-muted-foreground text-center mt-20">Senador não encontrado ou sem análise.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate("/senado")} className="gap-2 mb-4">
            <ArrowLeft size={16} /> Voltar ao painel
          </Button>

          <div className="flex items-center gap-4">
            <img
              src={currentAnalise.senador_foto || ""}
              alt={currentAnalise.senador_nome}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-border shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador-sem-foto.png";
              }}
            />
            <div>
              <h1 className="text-xl font-black text-foreground">{currentAnalise.senador_nome}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-bold">
                  {currentAnalise.senador_partido}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  {currentAnalise.senador_uf}
                </span>
              </div>
              <div className={`flex items-center gap-2 mt-2 ${cfg.color}`}>
                <Icon size={16} />
                <span className="text-sm font-black uppercase tracking-wider">
                  {currentAnalise.classificacao}
                </span>
                <span className="text-sm font-bold ml-2">
                  {Number(currentAnalise.score).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Card className={cfg.bg}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black">{Number(currentAnalise.score).toFixed(1)}%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-governo">{currentAnalise.votos_alinhados}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Alinhados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black">{currentAnalise.total_votos}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Votos Úteis</p>
            </CardContent>
          </Card>
        </div>

        {evolutionData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Evolução do Alinhamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {evolutionData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.classificacao === "Governo"
                            ? "hsl(var(--governo))"
                            : entry.classificacao === "Oposição"
                            ? "hsl(var(--oposicao))"
                            : "hsl(var(--centro))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Filter size={14} /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
                <Input
                  placeholder="Buscar matéria..."
                  className="pl-9 h-9 text-xs"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-24 h-9 text-xs">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={voteTypeFilter} onValueChange={setVoteTypeFilter}>
                <SelectTrigger className="w-24 h-9 text-xs">
                  <SelectValue placeholder="Voto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Voting list */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Vote size={14} /> Votações ({filteredVotos.length})
              </CardTitle>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs font-bold text-muted-foreground">
                    {page + 1}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paginatedVotos.map((v) => {
                const votacao = votacaoMap[v.codigo_sessao_votacao];
                const depNorm = normalizeVotoLabel(v.voto);

                const materiaLabel =
                  votacao?.sigla_materia && votacao?.numero_materia
                    ? `${votacao.sigla_materia} ${votacao.numero_materia}${
                        votacao.materia_ano ? `/${votacao.materia_ano}` : ""
                      }`
                    : null;

                return (
                  <div
                    key={v.id}
                    className="p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {votacao?.ementa ? (
                          <p className="text-xs font-semibold text-foreground line-clamp-2">
                            {votacao.ementa}
                          </p>
                        ) : votacao?.descricao ? (
                          <p className="text-xs font-semibold text-foreground line-clamp-2">
                            {votacao.descricao}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Votação {v.codigo_sessao_votacao}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {materiaLabel && (
                            <Badge variant="outline" className="text-[9px]">
                              {materiaLabel}
                            </Badge>
                          )}
                          {votacao?.data && (
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(votacao.data).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {votacao?.resultado && (
                            <Badge
                              variant="secondary"
                              className="text-[9px]"
                            >
                              {votacao.resultado === "A" ? "Aprovada" : votacao.resultado === "R" ? "Rejeitada" : votacao.resultado}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={depNorm === "sim" ? "default" : depNorm === "não" ? "destructive" : "secondary"}
                          className="text-[10px] font-bold"
                        >
                          {v.voto}
                        </Badge>
                      </div>
                    </div>

                    {/* External links */}
                    <div className="flex items-center gap-2 mt-2">
                      {materiaLabel && (
                        <a
                          href={`https://www25.senado.leg.br/web/atividade/materias/-/materia/${votacao?.sigla_materia?.toLowerCase()}/${votacao?.numero_materia}/${votacao?.materia_ano || votacao?.ano}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink size={10} /> Matéria
                        </a>
                      )}
                      <a
                        href={`https://www.google.com/search?q=site:senado.leg.br+${encodeURIComponent(
                          materiaLabel || votacao?.descricao || `votação ${v.codigo_sessao_votacao}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-bold text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        <Search size={10} /> Google
                      </a>
                    </div>
                  </div>
                );
              })}

              {filteredVotos.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground font-medium">Nenhuma votação encontrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
