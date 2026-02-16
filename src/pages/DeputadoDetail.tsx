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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type Analise = Tables<"analises_deputados">;

interface VotoDeputado {
  id: string;
  deputado_id: number;
  id_votacao: string;
  voto: string;
  ano: number;
}

interface Votacao {
  id_votacao: string;
  data: string | null;
  descricao: string | null;
  sigla_orgao: string | null;
  proposicao_tipo: string | null;
  proposicao_numero: string | null;
  proposicao_ementa: string | null;
}

interface Orientacao {
  id_votacao: string;
  sigla_orgao_politico: string;
  orientacao_voto: string;
}

const classConfig: Record<string, { color: string; icon: any; bg: string }> = {
  Governo: { color: "text-governo", icon: UserCheck, bg: "bg-governo/10" },
  Centro: { color: "text-centro", icon: UserMinus, bg: "bg-centro/10" },
  Oposição: { color: "text-oposicao", icon: UserX, bg: "bg-oposicao/10" },
  "Sem Dados": { color: "text-muted-foreground", icon: BarChart2, bg: "bg-muted" },
};

const ITEMS_PER_PAGE = 20;

export default function DeputadoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const depId = Number(id);

  const [analises, setAnalises] = useState<Analise[]>([]);
  const [votos, setVotos] = useState<VotoDeputado[]>([]);
  const [votacoes, setVotacoes] = useState<Votacao[]>([]);
  const [orientacoes, setOrientacoes] = useState<Orientacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!depId) return;
    setLoading(true);

    const loadData = async () => {
      // Fetch all years of analysis for this deputy
      const [analiseRes, votosRes] = await Promise.all([
        supabase
          .from("analises_deputados")
          .select("*")
          .eq("deputado_id", depId)
          .order("ano", { ascending: true }),
        supabase
          .from("votos_deputados" as any)
          .select("*")
          .eq("deputado_id", depId)
          .order("id_votacao", { ascending: false }) as any,
      ]);

      const analiseData = (analiseRes.data || []) as Analise[];
      const votosData = ((votosRes as any).data || []) as VotoDeputado[];
      setAnalises(analiseData);
      setVotos(votosData);

      // Fetch votação details for these votes
      const votacaoIds = [...new Set(votosData.map((v) => v.id_votacao))];
      if (votacaoIds.length > 0) {
        // Fetch in batches of 100
        const allVotacoes: Votacao[] = [];
        const allOrientacoes: Orientacao[] = [];
        for (let i = 0; i < votacaoIds.length; i += 100) {
          const batch = votacaoIds.slice(i, i + 100);
          const [votRes, oriRes] = await Promise.all([
            supabase
              .from("votacoes")
              .select("id_votacao,data,descricao,sigla_orgao,proposicao_tipo,proposicao_numero,proposicao_ementa")
              .in("id_votacao", batch),
            supabase
              .from("orientacoes")
              .select("id_votacao,sigla_orgao_politico,orientacao_voto")
              .in("id_votacao", batch),
          ]);
          allVotacoes.push(...((votRes.data || []) as Votacao[]));
          allOrientacoes.push(...((oriRes.data || []) as Orientacao[]));
        }
        setVotacoes(allVotacoes);
        setOrientacoes(allOrientacoes);
      }

      setLoading(false);
    };

    loadData();
  }, [depId]);

  const currentAnalise = analises.length > 0 ? analises[analises.length - 1] : null;
  const cfg = currentAnalise ? classConfig[currentAnalise.classificacao] || classConfig["Sem Dados"] : classConfig["Sem Dados"];
  const Icon = cfg.icon;

  // Evolution chart data
  const evolutionData = analises.map((a) => ({
    ano: a.ano,
    score: Number(a.score),
    classificacao: a.classificacao,
  }));

  // Build votação lookup maps
  const votacaoMap = useMemo(() => {
    const m: Record<string, Votacao> = {};
    votacoes.forEach((v) => (m[v.id_votacao] = v));
    return m;
  }, [votacoes]);

  const govOrientMap = useMemo(() => {
    const m: Record<string, string> = {};
    const govSiglas = ["governo", "gov.", "líder do governo", "lidgov"];
    orientacoes.forEach((o) => {
      if (govSiglas.includes(o.sigla_orgao_politico.toLowerCase().trim())) {
        m[o.id_votacao] = o.orientacao_voto;
      }
    });
    return m;
  }, [orientacoes]);

  // Paginated votes
  const totalPages = Math.ceil(votos.length / ITEMS_PER_PAGE);
  const paginatedVotos = votos.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

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
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 mb-6">
          <ArrowLeft size={16} /> Voltar
        </Button>
        <p className="text-muted-foreground text-center mt-20">Deputado não encontrado ou sem análise.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 mb-4">
            <ArrowLeft size={16} /> Voltar ao painel
          </Button>

          <div className="flex items-center gap-4">
            <img
              src={currentAnalise.deputado_foto || ""}
              alt={currentAnalise.deputado_nome}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-border shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://www.camara.leg.br/tema/assets/images/foto-deputado-ausente.png";
              }}
            />
            <div>
              <h1 className="text-xl font-black text-foreground">{currentAnalise.deputado_nome}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-bold">
                  {currentAnalise.deputado_partido}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  {currentAnalise.deputado_uf}
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
        {/* Stats row */}
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

        {/* Evolution chart */}
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

        {/* Voting list with pagination */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Vote size={14} /> Votações ({votos.length})
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
                const votacao = votacaoMap[v.id_votacao];
                const govOrient = govOrientMap[v.id_votacao];
                const depNorm = normalizeVotoLabel(v.voto);
                const govNorm = govOrient ? normalizeVotoLabel(govOrient) : null;
                const isAligned = depNorm && govNorm && depNorm === govNorm;

                return (
                  <div
                    key={v.id_votacao}
                    className={`p-3 rounded-lg border ${
                      isAligned
                        ? "border-governo/30 bg-governo/5"
                        : govNorm
                        ? "border-oposicao/30 bg-oposicao/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {votacao?.proposicao_ementa ? (
                          <p className="text-xs font-semibold text-foreground line-clamp-2">
                            {votacao.proposicao_tipo && votacao.proposicao_numero && (
                              <span className="font-black text-primary mr-1">
                                {votacao.proposicao_tipo} {votacao.proposicao_numero}
                              </span>
                            )}
                            {votacao.proposicao_ementa}
                          </p>
                        ) : votacao?.descricao ? (
                          <p className="text-xs font-semibold text-foreground line-clamp-2">
                            {votacao.descricao}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Votação {v.id_votacao}
                          </p>
                        )}
                        {votacao?.sigla_orgao && (
                          <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 inline-block">
                            {votacao.sigla_orgao}
                            {votacao?.data && ` • ${new Date(votacao.data).toLocaleDateString("pt-BR")}`}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            v.voto.toLowerCase().includes("sim")
                              ? "border-governo/50 text-governo"
                              : v.voto.toLowerCase().includes("não")
                              ? "border-oposicao/50 text-oposicao"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {v.voto}
                        </Badge>
                        {govOrient && (
                          <span className="text-[8px] font-bold text-muted-foreground">
                            Gov: {govOrient}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {votos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma votação registrada para este deputado.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function normalizeVotoLabel(voto: string): string {
  const v = voto.trim().toLowerCase();
  if (v === "sim" || v === "yes") return "sim";
  if (v === "não" || v === "nao" || v === "no") return "não";
  return v;
}
