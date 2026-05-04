import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, TrendingUp, TrendingDown, AlertCircle, Star, ExternalLink, Tag, BarChart3, LayoutGrid, Flag, Search, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line, ReferenceArea } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getBancada } from "@/lib/bancadas";
import { useToast } from "@/hooks/use-toast";
import { statsByEra, deltaPct, ERA_COLORS, eraDe } from "@/lib/governmentEras";

interface Props {
  ano: number;
  deputados: any[];
  senadores: any[];
  partidos: string[];
  allYearsDeputados?: any[];
  allYearsSenadores?: any[];
}

export function PartidoInsightsTab({ ano, deputados, senadores, partidos, allYearsDeputados = [], allYearsSenadores = [] }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [partido, setPartido] = useState<string>("");
  const [savedFiliacao, setSavedFiliacao] = useState<string | null>(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [temaDist, setTemaDist] = useState<{ tema: string; sim: number; nao: number; outros: number; total: number }[]>([]);
  const [loadingTemas, setLoadingTemas] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("partido_filiacao").eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data?.partido_filiacao) {
          setSavedFiliacao(data.partido_filiacao);
          setPartido((p) => p || data.partido_filiacao);
        }
      });
  }, [user]);

  const merged = useMemo(() => {
    const dep = deputados.filter((d) => d.deputado_partido === partido).map((d) => ({
      id: d.deputado_id, nome: d.deputado_nome, score: Number(d.score || 0), uf: d.deputado_uf,
      classificacao: d.classificacao, casa: "Câmara" as const, totalVotos: d.total_votos || 0,
    }));
    const sen = senadores.filter((s) => s.senador_partido === partido).map((s) => ({
      id: s.senador_id, nome: s.senador_nome, score: Number(s.score || 0), uf: s.senador_uf,
      classificacao: s.classificacao, casa: "Senado" as const, totalVotos: s.total_votos || 0,
    }));
    return [...dep, ...sen].filter((p) => p.totalVotos > 0);
  }, [deputados, senadores, partido]);

  const stats = useMemo(() => {
    if (merged.length === 0) return null;
    const sorted = [...merged].sort((a, b) => b.score - a.score);
    const avg = merged.reduce((s, p) => s + p.score, 0) / merged.length;
    const stdev = Math.sqrt(merged.reduce((s, p) => s + (p.score - avg) ** 2, 0) / merged.length);
    const dissidentes = sorted.filter((p) => Math.abs(p.score - avg) > Math.max(15, stdev * 1.2)).slice(0, 5);
    const bancada = getBancada(partido);
    const blocos = {
      Governo: sorted.filter((p) => p.classificacao === "Governo"),
      Centro: sorted.filter((p) => p.classificacao === "Centro"),
      Oposição: sorted.filter((p) => p.classificacao === "Oposição"),
    };
    return { sorted, avg, stdev, dissidentes, bancada, total: merged.length, blocos };
  }, [merged, partido]);

  // ===== Era stats (Bolsonaro 2019-22 × Lula 2023-26) =====
  const eraData = useMemo(() => {
    if (!partido) return null;
    const dep = (allYearsDeputados || []).filter((d: any) => d.deputado_partido === partido)
      .map((d: any) => ({ ano: d.ano, score: Number(d.score) || 0, total_votos: Number(d.total_votos) || 0, classificacao: d.classificacao }));
    const sen = (allYearsSenadores || []).filter((s: any) => s.senador_partido === partido)
      .map((s: any) => ({ ano: s.ano, score: Number(s.score) || 0, total_votos: Number(s.total_votos) || 0, classificacao: s.classificacao }));
    const all = [...dep, ...sen];
    if (all.length === 0) return null;
    const buckets = statsByEra(all);
    const yearMap: Record<number, { sum: number; w: number }> = {};
    all.forEach((r) => {
      yearMap[r.ano] = yearMap[r.ano] || { sum: 0, w: 0 };
      const w = r.total_votos || 1;
      yearMap[r.ano].sum += r.score * w;
      yearMap[r.ano].w += w;
    });
    const timeline = Object.entries(yearMap)
      .map(([ano, v]) => ({ ano: Number(ano), score: v.w > 0 ? Math.round((v.sum / v.w) * 10) / 10 : 0, era: eraDe(Number(ano)) }))
      .sort((a, b) => a.ano - b.ano);
    const delta = deltaPct(buckets.Lula.scoreAvg, buckets.Bolsonaro.scoreAvg);
    const hasBolso = buckets.Bolsonaro.parlamentares > 0;
    const hasLula = buckets.Lula.parlamentares > 0;
    return { buckets, timeline, delta, hasBolso, hasLula };
  }, [partido, allYearsDeputados, allYearsSenadores]);

  // Distribuição por tema: usa votacao_temas + votos do partido
  useEffect(() => {
    if (!partido || merged.length === 0) { setTemaDist([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingTemas(true);
      const depIds = merged.filter((p) => p.casa === "Câmara").map((p) => p.id);
      const senIds = merged.filter((p) => p.casa === "Senado").map((p) => p.id);
      const [temasRes, depVotosRes, senVotosRes] = await Promise.all([
        supabase.from("votacao_temas").select("votacao_id, casa, tema").eq("ano", ano).limit(5000),
        depIds.length > 0
          ? supabase.from("votos_deputados").select("id_votacao, voto").eq("ano", ano).in("deputado_id", depIds.slice(0, 200)).limit(20000)
          : Promise.resolve({ data: [] as any[] }),
        senIds.length > 0
          ? supabase.from("votos_senadores").select("codigo_sessao_votacao, voto").eq("ano", ano).in("senador_id", senIds.slice(0, 100)).limit(10000)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const temaMap = new Map<string, string>();
      (temasRes.data || []).forEach((t: any) => temaMap.set(`${t.casa}-${t.votacao_id}`, t.tema));
      const counts: Record<string, { sim: number; nao: number; outros: number }> = {};
      const tally = (key: string, voto: string) => {
        const tema = temaMap.get(key);
        if (!tema) return;
        const v = (voto || "").toLowerCase();
        counts[tema] = counts[tema] || { sim: 0, nao: 0, outros: 0 };
        if (v === "sim" || v === "favorável") counts[tema].sim++;
        else if (v === "não" || v === "nao" || v === "contrário" || v === "contrario") counts[tema].nao++;
        else counts[tema].outros++;
      };
      (depVotosRes.data || []).forEach((v: any) => tally(`camara-${v.id_votacao}`, v.voto));
      (senVotosRes.data || []).forEach((v: any) => tally(`senado-${v.codigo_sessao_votacao}`, v.voto));
      const arr = Object.entries(counts).map(([tema, c]) => ({ tema, ...c, total: c.sim + c.nao + c.outros })).filter((x) => x.total >= 5).sort((a, b) => b.total - a.total).slice(0, 10);
      setTemaDist(arr);
      setLoadingTemas(false);
    })();
    return () => { cancelled = true; };
  }, [partido, ano, merged]);

  const saveFiliacao = async () => {
    if (!user || !partido) return;
    setLoadingSave(true);
    const { error } = await supabase.from("profiles").update({ partido_filiacao: partido } as any).eq("user_id", user.id);
    setLoadingSave(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSavedFiliacao(partido);
      toast({ title: "Partido salvo", description: `Você acompanhará ${partido}.` });
    }
  };

  const blocoColor = (cls: string) =>
    cls === "Governo" ? "bg-governo/10 text-governo border-governo/30" :
    cls === "Oposição" ? "bg-oposicao/10 text-oposicao border-oposicao/30" :
    "bg-primary/10 text-primary border-primary/30";

  // ===== Empty / setup states =====
  if (!partido) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Flag size={26} className="text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black">Acompanhe o seu partido</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Escolha um partido para ver alinhamento, dissidentes, distribuição por bloco e temas em {ano}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Select value={partido} onValueChange={setPartido}>
              <SelectTrigger className="h-9 text-xs w-[220px]"><SelectValue placeholder="Escolha um partido" /></SelectTrigger>
              <SelectContent>{partidos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!user && <p className="text-[10px] text-muted-foreground">Faça login para salvar sua filiação.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== Header sticky ===== */}
      <Card className="sticky top-14 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-black text-primary text-lg shrink-0">
            {partido.slice(0, 4)}
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black">{partido}</h2>
              {stats && <Badge variant="outline" className={blocoColor(stats.bancada || "Centro")}>{stats.bancada || "—"}</Badge>}
              {savedFiliacao === partido && <Badge variant="secondary" className="text-[9px] gap-1"><Star size={9} /> Acompanhando</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats ? `${stats.total} parlamentares · score médio ${stats.avg.toFixed(1)}%` : "Carregando..."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={partido} onValueChange={setPartido}>
              <SelectTrigger className="h-9 text-xs w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{partidos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            {user && (
              <Button size="sm" variant={savedFiliacao === partido ? "secondary" : "default"} onClick={saveFiliacao} disabled={loadingSave} className="gap-1">
                <Star size={12} /> {savedFiliacao === partido ? "Salvo" : "Salvar filiação"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!stats && (
        <Card><CardContent className="py-10 text-center text-xs text-muted-foreground">
          Sem parlamentares com votos registrados em {ano} para {partido}.
        </CardContent></Card>
      )}

      {stats && (
        <Tabs defaultValue="visao">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="visao" className="gap-1"><LayoutGrid size={12} /> Visão</TabsTrigger>
            <TabsTrigger value="membros" className="gap-1"><Users size={12} /> Membros</TabsTrigger>
            <TabsTrigger value="dissidentes" className="gap-1"><AlertCircle size={12} /> Dissidentes</TabsTrigger>
            <TabsTrigger value="temas" className="gap-1"><Tag size={12} /> Temas</TabsTrigger>
            <TabsTrigger value="ranking" className="gap-1"><BarChart3 size={12} /> Ranking</TabsTrigger>
            <TabsTrigger value="eras" className="gap-1"><History size={12} /> Bolsonaro × Lula</TabsTrigger>
          </TabsList>

          {/* ====== Visão geral ====== */}
          <TabsContent value="visao" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card><CardContent className="p-3 text-center"><p className="text-xl font-black text-primary">{stats.total}</p><p className="text-[9px] uppercase font-bold text-muted-foreground">Parlamentares</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xl font-black">{stats.avg.toFixed(1)}%</p><p className="text-[9px] uppercase font-bold text-muted-foreground">Alinhamento médio</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xl font-black">{stats.stdev.toFixed(1)}pp</p><p className="text-[9px] uppercase font-bold text-muted-foreground">Coerência (desvio)</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xl font-black">{stats.dissidentes.length}</p><p className="text-[9px] uppercase font-bold text-muted-foreground">Dissidentes</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por bloco</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(["Governo", "Centro", "Oposição"] as const).map((cls) => {
                  const n = stats.blocos[cls].length;
                  const pct = stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;
                  return (
                    <div key={cls} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">{cls}</span>
                        <span className="text-muted-foreground">{n} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${cls === "Governo" ? "bg-governo" : cls === "Oposição" ? "bg-oposicao" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== Membros ====== */}
          <TabsContent value="membros" className="space-y-3 mt-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar membro..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="pl-8 h-9 text-xs" />
            </div>
            <Accordion type="multiple" defaultValue={["Governo", "Centro", "Oposição"]}>
              {(["Governo", "Centro", "Oposição"] as const).map((cls) => {
                const list = stats.blocos[cls].filter((p) => !memberSearch.trim() || p.nome.toLowerCase().includes(memberSearch.toLowerCase()));
                if (list.length === 0 && memberSearch) return null;
                return (
                  <AccordionItem key={cls} value={cls}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={blocoColor(cls)}>{cls}</Badge>
                        <span className="text-muted-foreground">{list.length}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {list.length === 0 ? <p className="text-xs text-muted-foreground py-2">Nenhum membro neste bloco.</p> : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {list.map((x) => (
                            <button key={`${x.casa}-${x.id}`} onClick={() => navigate(`/${x.casa === "Câmara" ? "deputado" : "senador"}/${x.id}`)}
                              className="flex items-center justify-between gap-2 p-2 rounded-md border border-border hover:bg-accent text-left">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">{x.nome}</p>
                                <p className="text-[10px] text-muted-foreground">{x.uf || "—"} · {x.casa} · {x.totalVotos} votos</p>
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">{x.score.toFixed(0)}%</Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </TabsContent>

          {/* ====== Dissidentes ====== */}
          <TabsContent value="dissidentes" className="space-y-2 mt-3">
            {stats.dissidentes.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-xs text-muted-foreground">
                Partido coeso — nenhum dissidente claro em {ano}.
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {stats.dissidentes.map((d) => (
                  <Card key={`${d.casa}-${d.id}`} className="hover:border-primary/40 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <button onClick={() => navigate(`/${d.casa === "Câmara" ? "deputado" : "senador"}/${d.id}`)} className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold truncate flex items-center gap-1">{d.nome} <ExternalLink size={11} className="text-muted-foreground" /></p>
                        <p className="text-[10px] text-muted-foreground">{d.uf || "—"} · {d.casa}</p>
                      </button>
                      <div className="text-right">
                        <p className={`text-sm font-black ${d.score > stats.avg ? "text-governo" : "text-oposicao"}`}>
                          {d.score > stats.avg ? <TrendingUp size={11} className="inline" /> : <TrendingDown size={11} className="inline" />}
                          {" "}{d.score.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {d.score > stats.avg ? "+" : ""}{(d.score - stats.avg).toFixed(1)}pp vs média
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ====== Temas ====== */}
          <TabsContent value="temas" className="space-y-2 mt-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tag size={14} className="text-primary" /> Distribuição por tema em {ano}</CardTitle></CardHeader>
              <CardContent>
                {loadingTemas ? <p className="text-xs text-muted-foreground py-4 text-center">Carregando temas...</p> : temaDist.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Sem votações classificadas por tema neste ano.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, temaDist.length * 28)}>
                    <BarChart data={temaDist} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="tema" width={75} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sim" stackId="a" name="Sim" fill="hsl(var(--governo))" />
                      <Bar dataKey="nao" stackId="a" name="Não" fill="hsl(var(--oposicao))" />
                      <Bar dataKey="outros" stackId="a" name="Outros" fill="hsl(var(--muted-foreground))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== Ranking ====== */}
          <TabsContent value="ranking" className="mt-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top 20 — alinhamento</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.sorted.slice(0, 20)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nome" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={70} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}