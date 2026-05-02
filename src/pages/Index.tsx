import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Search, AlertTriangle, Download, BarChart2, Trophy, GitCompareArrows, Target, ChevronDown, X, Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { StatsPanel } from "@/components/StatsPanel";
import { SyncHistoryPanel } from "@/components/SyncHistoryPanel";
import { DeputyCard } from "@/components/DeputyCard";
import { RankingTable } from "@/components/RankingTable";
import { PartyChart } from "@/components/PartyChart";
import { ComparisonView } from "@/components/ComparisonView";
import { ClassificationFilter } from "@/components/ClassificationFilter";
import { CentroTrendsCamara } from "@/components/CentroTrendsCamara";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDeputados } from "@/hooks/useDeputados";
import { useAnalises } from "@/hooks/useAnalises";
import { useAuth } from "@/hooks/useAuth";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useSyncRun } from "@/hooks/useSyncRun";
import { useFavoritos } from "@/hooks/useFavoritos";
import { useIsMobile } from "@/hooks/use-mobile";
import { exportAnalisesCsv } from "@/lib/exportCsv";
import { getBancada } from "@/lib/bancadas";
import { recomputeAnalises } from "@/lib/govMethodRecompute";

const GOV_PARTY = "PT";

const Index = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");
  const [ufFilter, setUfFilter] = useState("all");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [sortBy, setSortBy] = useState("nome");
  const [titulares, setTitulares] = useState(true);
  const [bancadaFilter, setBancadaFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [govMethod, setGovMethod] = useState<"lider" | "partido-gov">("lider");
  const [alignParty, setAlignParty] = useState("all");
  const [alignParlamentar, setAlignParlamentar] = useState("all");
  const [periodMode, setPeriodMode] = useState<"single" | "all">("single");
  const [aggAnalises, setAggAnalises] = useState<any[] | null>(null);
  const [aggLoading, setAggLoading] = useState(false);

  const legislatura = titulares ? 57 : undefined;
  const { deputados, partidos, loading: depLoading } = useDeputados(legislatura);
  const { analises: yearAnalises, loading: analLoading, syncing, error, syncDeputados, refetch } = useAnalises(ano);
  const { user, signInWithGoogle, signOut } = useAuth();
  const { lastSync, canSync, remainingSeconds, refetchStatus } = useSyncStatus("camara", user?.id);
  const { toggleFavorito, isFavorito } = useFavoritos(user?.id);
  const syncRun = useSyncRun();

  // Fetch and merge multi-year data when periodMode === "all"
  useEffect(() => {
    if (periodMode !== "all") { setAggAnalises(null); return; }
    let cancelled = false;
    (async () => {
      setAggLoading(true);
      const { data } = await supabase
        .from("analises_deputados")
        .select("*")
        .in("ano", [2023, 2024, 2025, 2026])
        .limit(10000);
      if (cancelled) return;
      // Aggregate: weight by total_votos
      const byId: Record<number, any> = {};
      (data || []).forEach((a: any) => {
        const id = a.deputado_id;
        if (!byId[id]) {
          byId[id] = { ...a, _scoreSum: 0, _wSum: 0, total_votos: 0, votos_alinhados: 0 };
        }
        const w = Number(a.total_votos) || 0;
        byId[id]._scoreSum += Number(a.score) * w;
        byId[id]._wSum += w;
        byId[id].total_votos += Number(a.total_votos) || 0;
        byId[id].votos_alinhados += Number(a.votos_alinhados) || 0;
        // Always keep latest metadata
        if (a.ano >= byId[id].ano) {
          byId[id].deputado_nome = a.deputado_nome;
          byId[id].deputado_partido = a.deputado_partido;
          byId[id].deputado_uf = a.deputado_uf;
          byId[id].deputado_foto = a.deputado_foto;
          byId[id].classificacao = a.classificacao;
          byId[id].ano = a.ano;
        }
      });
      const merged = Object.values(byId).map((a: any) => ({
        ...a,
        score: a._wSum > 0 ? Math.round((a._scoreSum / a._wSum) * 10) / 10 : 0,
      }));
      setAggAnalises(merged);
      setAggLoading(false);
    })();
    return () => { cancelled = true; };
  }, [periodMode]);

  const analises = periodMode === "all" && aggAnalises ? aggAnalises : yearAnalises;

  // Recomputed analyses according to selected gov-method (lider vs partido-gov).
  // When "partido-gov" is selected, score becomes similarity to PT's avg score and
  // classification is recomputed accordingly. UI components receive `displayAnalises`.
  const displayAnalises = useMemo(
    () => recomputeAnalises(analises as any[], govMethod, "deputado_partido", GOV_PARTY),
    [analises, govMethod],
  );

  const handleSync = async () => {
    const runId = crypto.randomUUID();
    syncRun.startRun(runId);
    const result = await syncDeputados(runId);
    if (result) {
      syncRun.finishRun("completed");
    } else {
      syncRun.finishRun("error", error || "Erro na sincronização");
    }
    refetchStatus();
  };

  const govPartyStats = useMemo(() => {
    // Always derived from raw analises (líder method) so the reference avg is stable
    const ptAnalises = analises.filter((a) => (a.deputado_partido || "").toUpperCase() === GOV_PARTY);
    const govPartyAvg = ptAnalises.length > 0
      ? ptAnalises.reduce((s, a) => s + Number(a.score), 0) / ptAnalises.length
      : 50;
    const acimaMedia = analises.filter((a) => Number(a.score) >= govPartyAvg).length;
    return { govParty: GOV_PARTY, govPartyAvg, acimaMedia, totalAnalises: analises.length };
  }, [analises]);

  const analiseMap = useMemo(() => {
    const map: Record<number, any> = {};
    displayAnalises.forEach((a) => { map[a.deputado_id] = a; });
    return map;
  }, [displayAnalises]);

  // Compute party average scores for comparison
  const partyAvgMap = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    displayAnalises.forEach(a => {
      const p = a.deputado_partido || "";
      if (!map[p]) map[p] = { sum: 0, count: 0 };
      map[p].sum += Number(a.score);
      map[p].count++;
    });
    const result: Record<string, number> = {};
    Object.entries(map).forEach(([p, v]) => { result[p] = v.sum / v.count; });
    return result;
  }, [displayAnalises]);

  // Reference parliamentarian score
  const refParlamentarScore = useMemo(() => {
    if (alignParlamentar === "all") return null;
    const a = displayAnalises.find(a => a.deputado_id === Number(alignParlamentar));
    return a ? Number(a.score) : null;
  }, [displayAnalises, alignParlamentar]);

  // Compute effective score for a deputy (considering alignment filters)
  const getEffectiveScore = (depId: number): number | null => {
    const analise = analiseMap[depId];
    if (!analise) return null;
    const score = Number(analise.score);
    
    if (alignParty !== "all") {
      const partyAvg = partyAvgMap[alignParty];
      if (partyAvg !== undefined) {
        // Similarity = 100 - |score - partyAvg|
        return Math.max(0, 100 - Math.abs(score - partyAvg));
      }
    }
    if (refParlamentarScore !== null) {
      return Math.max(0, 100 - Math.abs(score - refParlamentarScore));
    }
    return score;
  };

  const filteredDeputies = useMemo(() => {
    let result = deputados.filter((d) => {
      const matchName = d.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchParty = partyFilter === "all" || d.siglaPartido === partyFilter;
      const matchUf = ufFilter === "all" || d.siglaUf === ufFilter;
      const matchBancada = bancadaFilter === "all" || getBancada(d.siglaPartido) === bancadaFilter;
      const analise = analiseMap[d.id];
      const matchClass = classFilter === "all" || analise?.classificacao === classFilter;
      const effScore = getEffectiveScore(d.id);
      const matchScore = effScore === null || (effScore >= scoreRange[0] && effScore <= scoreRange[1]);
      return matchName && matchParty && matchUf && matchBancada && matchClass && matchScore;
    });

    result.sort((a, b) => {
      const aA = analiseMap[a.id];
      const bA = analiseMap[b.id];
      const useEffective = alignParty !== "all" || alignParlamentar !== "all";
      switch (sortBy) {
        case "score-desc": {
          const aS = useEffective ? (getEffectiveScore(a.id) ?? -1) : Number(aA?.score ?? -1);
          const bS = useEffective ? (getEffectiveScore(b.id) ?? -1) : Number(bA?.score ?? -1);
          return bS - aS;
        }
        case "score-asc": {
          const aS = useEffective ? (getEffectiveScore(a.id) ?? 999) : Number(aA?.score ?? 999);
          const bS = useEffective ? (getEffectiveScore(b.id) ?? 999) : Number(bA?.score ?? 999);
          return aS - bS;
        }
        case "partido": return (a.siglaPartido || "").localeCompare(b.siglaPartido || "");
        case "uf": return (a.siglaUf || "").localeCompare(b.siglaUf || "");
        default: return a.nome.localeCompare(b.nome);
      }
    });

    return result;
  }, [deputados, searchTerm, partyFilter, ufFilter, bancadaFilter, classFilter, scoreRange, sortBy, analiseMap, alignParty, alignParlamentar, partyAvgMap, refParlamentarScore]);

  const sidebarContent = (
    <>
      <StatsPanel
        analises={displayAnalises as any} totalDeputados={deputados.length}
        syncing={syncing} onSync={handleSync} user={user}
        lastSync={lastSync} canSync={canSync} remainingSeconds={remainingSeconds}
        syncEvents={syncRun.events} syncStatus={syncRun.status} syncError={syncRun.error}
        govMethod={govMethod} onGovMethodChange={setGovMethod} govPartyStats={govPartyStats}
      />
      {user && (
        <>
          <SyncHistoryPanel />
          <Button variant="outline" className="w-full" onClick={() => exportAnalisesCsv(analises, ano)} disabled={analises.length === 0}>
            <Download size={14} className="mr-2" /> Exportar CSV
          </Button>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        partyFilter={partyFilter} onPartyFilterChange={setPartyFilter}
        ano={ano} onAnoChange={setAno}
        classFilter={classFilter} onClassFilterChange={setClassFilter}
        partidos={partidos} loading={depLoading || analLoading}
        onRefresh={refetch} user={user} onSignIn={signInWithGoogle} onSignOut={signOut}
        casa="camara"
      />

      <main className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
        {/* Mobile: collapsible sidebar */}
        {isMobile ? (
          <Collapsible open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full gap-2 text-xs font-bold">
                <BarChart2 size={14} />
                Resumo & Sincronização
                <ChevronDown size={14} className={`ml-auto transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-3">
              {sidebarContent}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <aside className="xl:col-span-3 space-y-4">
            {sidebarContent}
          </aside>
        )}

        <section className={isMobile ? "" : "xl:col-span-9"} >
          <Tabs defaultValue="deputados">
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-none">
              <TabsList className="w-max min-w-full sm:w-auto">
                <TabsTrigger value="deputados" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><Users size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Deputados</span><span className="sm:hidden">Dep.</span></TabsTrigger>
                <TabsTrigger value="ranking" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><Trophy size={12} className="sm:w-3.5 sm:h-3.5" /> Ranking</TabsTrigger>
                <TabsTrigger value="partidos" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><BarChart2 size={12} className="sm:w-3.5 sm:h-3.5" /> Partidos</TabsTrigger>
                <TabsTrigger value="comparativo" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><GitCompareArrows size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Comparativo</span><span className="sm:hidden">Comp.</span></TabsTrigger>
                <TabsTrigger value="tendencias" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><Target size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Tendências</span><span className="sm:hidden">Tend.</span></TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="deputados" className="space-y-4 mt-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 sm:p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={18} className="text-destructive shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-destructive">{error}</p>
                </div>
              )}
              <ClassificationFilter
                analises={analises}
                classFilter={classFilter}
                onClassFilterChange={setClassFilter}
                ufFilter={ufFilter}
                onUfFilterChange={setUfFilter}
                scoreRange={scoreRange}
                onScoreRangeChange={setScoreRange}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                titulares={titulares}
                onTitularesChange={setTitulares}
                bancadaFilter={bancadaFilter}
                onBancadaFilterChange={setBancadaFilter}
                alignParty={alignParty}
                onAlignPartyChange={setAlignParty}
                alignParlamentar={alignParlamentar}
                onAlignParlamentarChange={setAlignParlamentar}
              />
              {/* Period mode + comparison banner */}
              <div className="flex flex-wrap items-center gap-2 bg-card p-2 sm:p-3 rounded-xl border border-border">
                <Layers size={14} className="text-primary shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">Período:</span>
                <Button size="sm" variant={periodMode === "single" ? "default" : "outline"} className="h-7 text-[10px] sm:text-xs" onClick={() => setPeriodMode("single")}>
                  Apenas {ano}
                </Button>
                <Button size="sm" variant={periodMode === "all" ? "default" : "outline"} className="h-7 text-[10px] sm:text-xs" onClick={() => setPeriodMode("all")} disabled={aggLoading}>
                  {aggLoading ? "Carregando..." : "Acumulado 2023-2026"}
                </Button>
                {(alignParty !== "all" || alignParlamentar !== "all") && (
                  <div className="ml-auto flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5">
                    <GitCompareArrows size={11} className="text-primary" />
                    <span className="text-[10px] font-bold text-primary">
                      {alignParty !== "all"
                        ? `vs Média ${alignParty} (${(partyAvgMap[alignParty] || 0).toFixed(1)}%)`
                        : `vs ${displayAnalises.find(a => a.deputado_id === Number(alignParlamentar))?.deputado_nome?.split(" ").slice(0,2).join(" ") || "Parl."}`}
                    </span>
                    <button onClick={() => { setAlignParty("all"); setAlignParlamentar("all"); }} className="text-primary hover:text-primary/70">
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between bg-card p-3 sm:p-4 rounded-xl border border-border">
                <h2 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users size={14} className="text-primary" /> {filteredDeputies.length} deputados
                </h2>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 sm:px-3 py-1 rounded-full uppercase tracking-widest">
                  {periodMode === "all" ? "2023-2026" : ano}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-10 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredDeputies.map((dep) => (
                  <DeputyCard
                    key={dep.id} deputado={dep} analise={analiseMap[dep.id]}
                    onClick={() => navigate(`/deputado/${dep.id}`)}
                    isFavorito={isFavorito(dep.id)}
                    onToggleFavorito={user ? toggleFavorito : undefined}
                  />
                ))}
              </div>
              {!depLoading && filteredDeputies.length === 0 && (
                <div className="py-12 sm:py-16 text-center bg-card rounded-2xl border-2 border-dashed border-border">
                  <Search size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-semibold text-sm">Nenhum deputado encontrado</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ranking" className="mt-4"><RankingTable analises={displayAnalises as any} /></TabsContent>
            <TabsContent value="partidos" className="mt-4"><PartyChart analises={displayAnalises as any} /></TabsContent>
            <TabsContent value="comparativo" className="mt-4">
              <ComparisonView analises={displayAnalises as any} onDeputyClick={(id) => navigate(`/deputado/${id}`)} />
            </TabsContent>
            <TabsContent value="tendencias" className="mt-4">
              <CentroTrendsCamara analises={displayAnalises as any} ano={ano} onDeputadoClick={(id) => navigate(`/deputado/${id}`)} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="text-center py-6 sm:py-8">
        <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] sm:tracking-[0.4em]">
          Monitor Legislativo • Transparência • {ano}
        </p>
      </footer>
    </div>
  );
};

export default Index;
