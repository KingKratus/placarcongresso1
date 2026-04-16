import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Search, AlertTriangle, Download, BarChart2, Trophy, GitCompareArrows, Target, ChevronDown, X, Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { StatsPanelSenado } from "@/components/StatsPanelSenado";
import { SyncHistoryPanel } from "@/components/SyncHistoryPanel";
import { SenadorCard } from "@/components/SenadorCard";
import { RankingTableSenado } from "@/components/RankingTableSenado";
import { PartyChartSenado } from "@/components/PartyChartSenado";
import { ComparisonViewSenado } from "@/components/ComparisonViewSenado";
import { ClassificationFilterSenado } from "@/components/ClassificationFilterSenado";
import { CentroTrendsSenado } from "@/components/CentroTrendsSenado";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSenadores } from "@/hooks/useSenadores";
import { useAnalisesSenado } from "@/hooks/useAnalisesSenado";
import { useAuth } from "@/hooks/useAuth";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useSyncRun } from "@/hooks/useSyncRun";
import { useFavoritos } from "@/hooks/useFavoritos";
import { useIsMobile } from "@/hooks/use-mobile";
import { exportAnalisesSenadorCsv } from "@/lib/exportCsvSenado";
import { getBancada } from "@/lib/bancadas";

const GOV_PARTY = "PT";

const Senado = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");
  const [ufFilter, setUfFilter] = useState("all");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [sortBy, setSortBy] = useState("nome");
  const [govMethod, setGovMethod] = useState<"lider" | "partido-gov">("lider");
  const [bancadaFilter, setBancadaFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alignParty, setAlignParty] = useState("all");
  const [alignParlamentar, setAlignParlamentar] = useState("all");
  const [periodMode, setPeriodMode] = useState<"single" | "all">("single");
  const [aggAnalises, setAggAnalises] = useState<any[] | null>(null);
  const [aggLoading, setAggLoading] = useState(false);

  const { senadores, partidos, loading: senLoading } = useSenadores();
  const { analises: yearAnalises, loading: analLoading, syncing, error, syncSenadores, refetch } = useAnalisesSenado(ano);
  const { user, signInWithGoogle, signOut } = useAuth();
  const { lastSync, canSync, remainingSeconds, refetchStatus } = useSyncStatus("senado", user?.id);
  const { toggleFavorito, isFavorito } = useFavoritos(user?.id);
  const syncRun = useSyncRun();

  // Multi-year aggregated analyses (especially useful for Senate which has fewer votes/year)
  useEffect(() => {
    if (periodMode !== "all") { setAggAnalises(null); return; }
    let cancelled = false;
    (async () => {
      setAggLoading(true);
      const { data } = await supabase
        .from("analises_senadores")
        .select("*")
        .in("ano", [2023, 2024, 2025, 2026])
        .limit(5000);
      if (cancelled) return;
      const byId: Record<number, any> = {};
      (data || []).forEach((a: any) => {
        const id = a.senador_id;
        if (!byId[id]) {
          byId[id] = { ...a, _scoreSum: 0, _wSum: 0, total_votos: 0, votos_alinhados: 0 };
        }
        const w = Number(a.total_votos) || 0;
        byId[id]._scoreSum += Number(a.score) * w;
        byId[id]._wSum += w;
        byId[id].total_votos += Number(a.total_votos) || 0;
        byId[id].votos_alinhados += Number(a.votos_alinhados) || 0;
        if (a.ano >= byId[id].ano) {
          byId[id].senador_nome = a.senador_nome;
          byId[id].senador_partido = a.senador_partido;
          byId[id].senador_uf = a.senador_uf;
          byId[id].senador_foto = a.senador_foto;
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

  const handleSync = async () => {
    const runId = crypto.randomUUID();
    syncRun.startRun(runId);
    const result = await syncSenadores(runId);
    if (result) {
      syncRun.finishRun("completed");
    } else {
      syncRun.finishRun("error", error || "Erro na sincronização");
    }
    refetchStatus();
  };

  const govPartyStats = useMemo(() => {
    const ptAnalises = analises.filter((a) => (a.senador_partido || "").toUpperCase() === GOV_PARTY);
    const govPartyAvg = ptAnalises.length > 0
      ? ptAnalises.reduce((s, a) => s + Number(a.score), 0) / ptAnalises.length
      : 50;
    const acimaMedia = analises.filter((a) => Number(a.score) >= govPartyAvg).length;
    return { govParty: GOV_PARTY, govPartyAvg, acimaMedia, totalAnalises: analises.length };
  }, [analises]);

  const analiseMap = useMemo(() => {
    const map: Record<number, (typeof analises)[0]> = {};
    analises.forEach((a) => { map[a.senador_id] = a; });
    return map;
  }, [analises]);

  const partyAvgMap = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    analises.forEach(a => {
      const p = a.senador_partido || "";
      if (!map[p]) map[p] = { sum: 0, count: 0 };
      map[p].sum += Number(a.score);
      map[p].count++;
    });
    const result: Record<string, number> = {};
    Object.entries(map).forEach(([p, v]) => { result[p] = v.sum / v.count; });
    return result;
  }, [analises]);

  const refParlamentarScore = useMemo(() => {
    if (alignParlamentar === "all") return null;
    const a = analises.find(a => a.senador_id === Number(alignParlamentar));
    return a ? Number(a.score) : null;
  }, [analises, alignParlamentar]);

  const getEffectiveScore = (senId: number): number | null => {
    const analise = analiseMap[senId];
    if (!analise) return null;
    const score = Number(analise.score);
    if (alignParty !== "all") {
      const partyAvg = partyAvgMap[alignParty];
      if (partyAvg !== undefined) return Math.max(0, 100 - Math.abs(score - partyAvg));
    }
    if (refParlamentarScore !== null) return Math.max(0, 100 - Math.abs(score - refParlamentarScore));
    return score;
  };

  const filteredSenadores = useMemo(() => {
    let result = senadores.filter((s) => {
      const matchName = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchParty = partyFilter === "all" || s.siglaPartido === partyFilter;
      const matchUf = ufFilter === "all" || s.siglaUf === ufFilter;
      const matchBancada = bancadaFilter === "all" || getBancada(s.siglaPartido) === bancadaFilter;
      const analise = analiseMap[s.id];
      const matchClass = classFilter === "all" || analise?.classificacao === classFilter;
      const effScore = getEffectiveScore(s.id);
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
  }, [senadores, searchTerm, partyFilter, ufFilter, bancadaFilter, classFilter, scoreRange, sortBy, analiseMap, alignParty, alignParlamentar, partyAvgMap, refParlamentarScore]);

  const partidosForNavbar = partidos.map((p, i) => ({ id: i, sigla: p.sigla, nome: p.sigla }));

  const sidebarContent = (
    <>
      <StatsPanelSenado
        analises={analises} totalSenadores={senadores.length}
        syncing={syncing} onSync={handleSync} user={user}
        lastSync={lastSync} canSync={canSync} remainingSeconds={remainingSeconds}
        syncEvents={syncRun.events} syncStatus={syncRun.status} syncError={syncRun.error}
        govMethod={govMethod}
        onGovMethodChange={setGovMethod}
        govPartyStats={govPartyStats}
      />
      {user && (
        <>
          <SyncHistoryPanel />
          <Button variant="outline" className="w-full" onClick={() => exportAnalisesSenadorCsv(analises, ano)} disabled={analises.length === 0}>
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
        partidos={partidosForNavbar} loading={senLoading || analLoading}
        onRefresh={refetch} user={user} onSignIn={signInWithGoogle} onSignOut={signOut}
        casa="senado"
      />

      <main className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
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

        <section className={isMobile ? "" : "xl:col-span-9"}>
          <Tabs defaultValue="senadores">
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-none">
              <TabsList className="w-max min-w-full sm:w-auto">
                <TabsTrigger value="senadores" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><Users size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Senadores</span><span className="sm:hidden">Sen.</span></TabsTrigger>
                <TabsTrigger value="ranking" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><Trophy size={12} className="sm:w-3.5 sm:h-3.5" /> Ranking</TabsTrigger>
                <TabsTrigger value="partidos" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><BarChart2 size={12} className="sm:w-3.5 sm:h-3.5" /> Partidos</TabsTrigger>
                <TabsTrigger value="comparativo" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><GitCompareArrows size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Comparativo</span><span className="sm:hidden">Comp.</span></TabsTrigger>
                <TabsTrigger value="tendencias" className="gap-1 sm:gap-2 text-[10px] sm:text-sm"><Target size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Tendências</span><span className="sm:hidden">Tend.</span></TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="senadores" className="space-y-4 mt-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 sm:p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={18} className="text-destructive shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-destructive">{error}</p>
                </div>
              )}
              <ClassificationFilterSenado
                analises={analises}
                classFilter={classFilter}
                onClassFilterChange={setClassFilter}
                ufFilter={ufFilter}
                onUfFilterChange={setUfFilter}
                scoreRange={scoreRange}
                onScoreRangeChange={setScoreRange}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                bancadaFilter={bancadaFilter}
                onBancadaFilterChange={setBancadaFilter}
                alignParty={alignParty}
                onAlignPartyChange={setAlignParty}
                alignParlamentar={alignParlamentar}
                onAlignParlamentarChange={setAlignParlamentar}
              />
              <div className="flex items-center justify-between bg-card p-3 sm:p-4 rounded-xl border border-border">
                <h2 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users size={14} className="text-primary" /> {filteredSenadores.length} senadores
                </h2>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 sm:px-3 py-1 rounded-full uppercase tracking-widest">{ano}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-10 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredSenadores.map((sen) => (
                  <SenadorCard
                    key={sen.id} senador={sen} analise={analiseMap[sen.id]}
                    onClick={() => navigate(`/senador/${sen.id}`)}
                    isFavorito={isFavorito(sen.id)}
                    onToggleFavorito={user ? toggleFavorito : undefined}
                  />
                ))}
              </div>
              {!senLoading && filteredSenadores.length === 0 && (
                <div className="py-12 sm:py-16 text-center bg-card rounded-2xl border-2 border-dashed border-border">
                  <Search size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-semibold text-sm">Nenhum senador encontrado</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ranking" className="mt-4"><RankingTableSenado analises={analises} /></TabsContent>
            <TabsContent value="partidos" className="mt-4"><PartyChartSenado analises={analises} /></TabsContent>
            <TabsContent value="comparativo" className="mt-4">
              <ComparisonViewSenado analises={analises} onSenadorClick={(id) => navigate(`/senador/${id}`)} />
            </TabsContent>
            <TabsContent value="tendencias" className="mt-4">
              <CentroTrendsSenado analises={analises} ano={ano} onSenadorClick={(id) => navigate(`/senador/${id}`)} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="text-center py-6 sm:py-8">
        <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] sm:tracking-[0.4em]">
          Monitor Legislativo • Senado • {ano}
        </p>
      </footer>
    </div>
  );
};

export default Senado;
