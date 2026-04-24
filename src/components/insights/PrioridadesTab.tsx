import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TramitacaoTimeline } from "@/components/TramitacaoTimeline";
import { useToast } from "@/hooks/use-toast";
import {
  Vote, ThumbsUp, ThumbsDown, Minus, Flame, ExternalLink, GitBranch, Loader2,
  Search, Star, TrendingUp, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

interface Proposta {
  id: string;
  casa: "camara" | "senado";
  tipo: string;
  numero: string;
  ano: number;
  titulo: string;
  ementa: string | null;
  tema: string;
  url: string | null;
  destaque: boolean;
}

interface Agregado {
  proposicao_id: string;
  total_votos: number;
  prioridade_media: number;
  favor: number;
  contra: number;
  neutro: number;
}

interface MeuVoto {
  proposicao_id: string;
  prioridade: number;
  posicao: "favor" | "contra" | "neutro";
}

const TEMA_COLORS: Record<string, string> = {
  "Tributário": "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  "Direitos Humanos": "bg-pink-500/20 text-pink-700 dark:text-pink-300",
  "Político-Institucional": "bg-slate-500/20 text-slate-700 dark:text-slate-300",
  "Educação": "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "Saúde": "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "Segurança": "bg-red-500/20 text-red-700 dark:text-red-300",
  "Meio Ambiente": "bg-green-500/20 text-green-700 dark:text-green-300",
  "Trabalhista": "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
};

function temaClass(tema: string) {
  return TEMA_COLORS[tema] || "bg-muted text-muted-foreground";
}

export function PrioridadesTab() {
  const { toast } = useToast();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [agregados, setAgregados] = useState<Record<string, Agregado>>({});
  const [meusVotos, setMeusVotos] = useState<Record<string, MeuVoto>>({});
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [temaFilter, setTemaFilter] = useState("all");
  const [casaFilter, setCasaFilter] = useState<"all" | "camara" | "senado">("all");
  const [sortBy, setSortBy] = useState<"prioridade" | "votos" | "destaque">("destaque");

  // Per-card draft (slider+posição) before salvar
  const [draftVotes, setDraftVotes] = useState<Record<string, { prioridade: number; posicao: "favor" | "contra" | "neutro" }>>({});

  const [tramitacaoTarget, setTramitacaoTarget] = useState<Proposta | null>(null);
  const [tramitacaoOpen, setTramitacaoOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: props }, { data: aggs }, { data: { user: u } }] = await Promise.all([
      supabase.from("proposicoes_prioritarias").select("*").eq("ativa", true).order("ordem", { ascending: true }),
      supabase.from("prioridade_agregada" as any).select("*"),
      supabase.auth.getUser(),
    ]);
    setPropostas((props || []) as Proposta[]);
    const aMap: Record<string, Agregado> = {};
    (aggs || []).forEach((a: any) => { aMap[a.proposicao_id] = a; });
    setAgregados(aMap);
    setUser(u);

    if (u) {
      const { data: votos } = await supabase
        .from("prioridade_votos")
        .select("proposicao_id, prioridade, posicao")
        .eq("user_id", u.id);
      const vMap: Record<string, MeuVoto> = {};
      (votos || []).forEach((v: any) => { vMap[v.proposicao_id] = v; });
      setMeusVotos(vMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const temas = useMemo(() => Array.from(new Set(propostas.map(p => p.tema))).sort(), [propostas]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    let list = propostas.filter(p => {
      if (temaFilter !== "all" && p.tema !== temaFilter) return false;
      if (casaFilter !== "all" && p.casa !== casaFilter) return false;
      if (term) {
        const hay = `${p.titulo} ${p.ementa || ""} ${p.tipo} ${p.numero} ${p.ano} ${p.tema}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    if (sortBy === "prioridade") {
      list = [...list].sort((a, b) => (agregados[b.id]?.prioridade_media || 0) - (agregados[a.id]?.prioridade_media || 0));
    } else if (sortBy === "votos") {
      list = [...list].sort((a, b) => (agregados[b.id]?.total_votos || 0) - (agregados[a.id]?.total_votos || 0));
    } else {
      list = [...list].sort((a, b) => Number(b.destaque) - Number(a.destaque));
    }
    return list;
  }, [propostas, search, temaFilter, casaFilter, sortBy, agregados]);

  const stats = useMemo(() => {
    const totalVotos = Object.values(agregados).reduce((s, a) => s + a.total_votos, 0);
    const totalProps = propostas.length;
    const meusContados = user ? Object.keys(meusVotos).length : 0;
    return { totalVotos, totalProps, meusContados };
  }, [agregados, propostas, meusVotos, user]);

  const rankingChart = useMemo(() => {
    return [...propostas]
      .map(p => ({
        nome: `${p.tipo} ${p.numero}/${p.ano}`,
        prioridade: agregados[p.id]?.prioridade_media || 0,
        votos: agregados[p.id]?.total_votos || 0,
        tema: p.tema,
      }))
      .filter(d => d.votos > 0)
      .sort((a, b) => b.prioridade - a.prioridade)
      .slice(0, 8);
  }, [propostas, agregados]);

  const getDraft = (p: Proposta) => {
    if (draftVotes[p.id]) return draftVotes[p.id];
    const meu = meusVotos[p.id];
    return meu
      ? { prioridade: meu.prioridade, posicao: meu.posicao }
      : { prioridade: 5, posicao: "neutro" as const };
  };

  const updateDraft = (id: string, patch: Partial<{ prioridade: number; posicao: "favor" | "contra" | "neutro" }>) => {
    setDraftVotes(prev => {
      const cur = prev[id] || { prioridade: 5, posicao: "neutro" as const };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const saveVote = async (p: Proposta) => {
    if (!user) {
      toast({ title: "Login necessário", description: "Entre com sua conta para registrar seu voto." });
      return;
    }
    setSavingId(p.id);
    const draft = getDraft(p);
    try {
      const { error } = await supabase.from("prioridade_votos").upsert({
        user_id: user.id,
        proposicao_id: p.id,
        prioridade: draft.prioridade,
        posicao: draft.posicao,
      }, { onConflict: "user_id,proposicao_id" });
      if (error) throw error;
      setMeusVotos(prev => ({ ...prev, [p.id]: { proposicao_id: p.id, prioridade: draft.prioridade, posicao: draft.posicao } }));
      // Refresh aggregate for this proposicao
      const { data: agg } = await supabase
        .from("prioridade_agregada" as any)
        .select("*")
        .eq("proposicao_id", p.id)
        .maybeSingle();
      if (agg) setAgregados(prev => ({ ...prev, [p.id]: agg as any }));
      toast({ title: "Voto registrado", description: `Prioridade ${draft.prioridade}/10 — ${draft.posicao === "favor" ? "A favor" : draft.posicao === "contra" ? "Contra" : "Neutro"}` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar voto", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const removeVote = async (p: Proposta) => {
    if (!user) return;
    setSavingId(p.id);
    try {
      await supabase.from("prioridade_votos").delete().eq("user_id", user.id).eq("proposicao_id", p.id);
      setMeusVotos(prev => { const next = { ...prev }; delete next[p.id]; return next; });
      setDraftVotes(prev => { const next = { ...prev }; delete next[p.id]; return next; });
      const { data: agg } = await supabase
        .from("prioridade_agregada" as any)
        .select("*")
        .eq("proposicao_id", p.id)
        .maybeSingle();
      if (agg) setAgregados(prev => ({ ...prev, [p.id]: agg as any }));
      toast({ title: "Voto removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header explicativo */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Vote size={14} className="text-primary" /> Prioridades Cidadãs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Vote de <strong className="text-foreground">0 a 10</strong> a prioridade que você gostaria que cada proposta tivesse no Congresso, e indique se é <strong className="text-emerald-600">a favor</strong>, <strong className="text-rose-600">contra</strong> ou <strong>neutro</strong>. Sua nota se soma ao ranking público da comunidade.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-black text-primary">{stats.totalProps}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Propostas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">{stats.totalVotos}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Votos cidadãos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">{stats.meusContados}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Seus votos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking chart */}
      {rankingChart.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <TrendingUp size={14} /> Top prioridades segundo a comunidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, rankingChart.length * 30)}>
              <BarChart data={rankingChart} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={75} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v: any, name: string) => [v, name === "prioridade" ? "Prioridade média" : "Votos"]}
                />
                <Bar dataKey="prioridade" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))">
                  {rankingChart.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proposta…" className="pl-9 h-9 text-xs" />
            </div>
            <Select value={temaFilter} onValueChange={setTemaFilter}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Tema" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos temas</SelectItem>
                {temas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={casaFilter} onValueChange={(v: any) => setCasaFilter(v)}>
              <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ambas</SelectItem>
                <SelectItem value="camara">Câmara</SelectItem>
                <SelectItem value="senado">Senado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="destaque">Destaques primeiro</SelectItem>
                <SelectItem value="prioridade">Maior prioridade</SelectItem>
                <SelectItem value="votos">Mais votados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!user && (
        <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md p-3">
          💡 <strong>Entre com sua conta</strong> (botão no topo) para registrar seus votos. Você pode visualizar e mudar de opinião quando quiser.
        </div>
      )}

      {/* Lista de propostas */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin mr-2" size={18} />
          <span className="text-sm text-muted-foreground">Carregando propostas…</span>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) => {
            const agg = agregados[p.id];
            const meu = meusVotos[p.id];
            const draft = getDraft(p);
            const totalPos = (agg?.favor || 0) + (agg?.contra || 0) + (agg?.neutro || 0);
            const isDirty = !meu || meu.prioridade !== draft.prioridade || meu.posicao !== draft.posicao;
            return (
              <Card key={p.id} className={p.destaque ? "border-primary/40" : ""}>
                <CardHeader className="pb-2 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        {p.tipo} {p.numero}/{p.ano} · {p.casa === "camara" ? "Câmara" : "Senado"}
                      </p>
                      <CardTitle className="text-sm leading-snug">{p.titulo}</CardTitle>
                    </div>
                    {p.destaque && <Flame className="text-amber-500 shrink-0" size={16} />}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={`text-[9px] px-1.5 py-0 border-0 ${temaClass(p.tema)}`}>{p.tema}</Badge>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
                        <ExternalLink size={10} /> Texto
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => { setTramitacaoTarget(p); setTramitacaoOpen(true); }}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <GitBranch size={10} /> Tramitação
                    </button>
                  </div>
                  {p.ementa && <p className="text-xs text-muted-foreground line-clamp-2">{p.ementa}</p>}
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Agregados */}
                  <div className="rounded-md bg-muted/40 p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
                      <span className="flex items-center gap-1"><BarChart3 size={10} /> Comunidade</span>
                      <span>{agg?.total_votos || 0} votos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${((agg?.prioridade_media || 0) / 10) * 100}%` }} />
                      </div>
                      <span className="text-xs font-black text-foreground w-10 text-right">{agg?.prioridade_media?.toFixed(1) || "—"}</span>
                    </div>
                    {totalPos > 0 && (
                      <div className="flex h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500" style={{ width: `${((agg!.favor) / totalPos) * 100}%` }} />
                        <div className="bg-slate-400" style={{ width: `${((agg!.neutro) / totalPos) * 100}%` }} />
                        <div className="bg-rose-500" style={{ width: `${((agg!.contra) / totalPos) * 100}%` }} />
                      </div>
                    )}
                    {totalPos > 0 && (
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span className="text-emerald-600 font-bold">{agg!.favor} a favor</span>
                        <span>{agg!.neutro} neutro</span>
                        <span className="text-rose-600 font-bold">{agg!.contra} contra</span>
                      </div>
                    )}
                  </div>

                  {/* Slider de prioridade */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sua prioridade</span>
                      <span className="text-lg font-black text-primary leading-none">{draft.prioridade}<span className="text-xs text-muted-foreground">/10</span></span>
                    </div>
                    <Slider
                      value={[draft.prioridade]}
                      onValueChange={(v) => updateDraft(p.id, { prioridade: v[0] })}
                      min={0} max={10} step={1}
                      disabled={!user}
                    />
                  </div>

                  {/* Posição */}
                  <Tabs
                    value={draft.posicao}
                    onValueChange={(v: any) => updateDraft(p.id, { posicao: v })}
                    className="w-full"
                  >
                    <TabsList className="grid grid-cols-3 h-8">
                      <TabsTrigger value="favor" className="text-[10px] gap-1" disabled={!user}>
                        <ThumbsUp size={10} /> A favor
                      </TabsTrigger>
                      <TabsTrigger value="neutro" className="text-[10px] gap-1" disabled={!user}>
                        <Minus size={10} /> Neutro
                      </TabsTrigger>
                      <TabsTrigger value="contra" className="text-[10px] gap-1" disabled={!user}>
                        <ThumbsDown size={10} /> Contra
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      disabled={!user || savingId === p.id || !isDirty}
                      onClick={() => saveVote(p)}
                    >
                      {savingId === p.id ? <Loader2 className="animate-spin mr-1" size={12} /> : <Star size={12} className="mr-1" />}
                      {meu ? "Atualizar" : "Registrar voto"}
                    </Button>
                    {meu && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={savingId === p.id} onClick={() => removeVote(p)}>
                        Remover
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 col-span-full">
              Nenhuma proposta encontrada com os filtros.
            </p>
          )}
        </div>
      )}

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
              casa={tramitacaoTarget.casa}
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