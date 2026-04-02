import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Search, AlertTriangle, Download, BarChart2, Trophy, GitCompareArrows, Target,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatsPanel } from "@/components/StatsPanel";
import { DeputyCard } from "@/components/DeputyCard";
import { RankingTable } from "@/components/RankingTable";
import { PartyChart } from "@/components/PartyChart";
import { ComparisonView } from "@/components/ComparisonView";
import { ClassificationFilter } from "@/components/ClassificationFilter";
import { CentroTrendsCamara } from "@/components/CentroTrendsCamara";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeputados } from "@/hooks/useDeputados";
import { useAnalises } from "@/hooks/useAnalises";
import { useAuth } from "@/hooks/useAuth";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useSyncRun } from "@/hooks/useSyncRun";
import { useFavoritos } from "@/hooks/useFavoritos";
import { exportAnalisesCsv } from "@/lib/exportCsv";
import { getBancada } from "@/lib/bancadas";

const Index = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");
  const [ufFilter, setUfFilter] = useState("all");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [sortBy, setSortBy] = useState("nome");
  const [titulares, setTitulares] = useState(true);
  const [bancadaFilter, setBancadaFilter] = useState("all");

  const legislatura = titulares ? 57 : undefined;
  const { deputados, partidos, loading: depLoading } = useDeputados(legislatura);
  const { analises, loading: analLoading, syncing, error, syncDeputados, refetch } = useAnalises(ano);
  const { user, signInWithGoogle, signOut } = useAuth();
  const { lastSync, canSync, remainingSeconds, refetchStatus } = useSyncStatus("camara", user?.id);
  const { toggleFavorito, isFavorito } = useFavoritos(user?.id);
  const syncRun = useSyncRun();

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

  const analiseMap = useMemo(() => {
    const map: Record<number, (typeof analises)[0]> = {};
    analises.forEach((a) => { map[a.deputado_id] = a; });
    return map;
  }, [analises]);

  const filteredDeputies = useMemo(() => {
    let result = deputados.filter((d) => {
      const matchName = d.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchParty = partyFilter === "all" || d.siglaPartido === partyFilter;
      const matchUf = ufFilter === "all" || d.siglaUf === ufFilter;
      const matchBancada = bancadaFilter === "all" || getBancada(d.siglaPartido) === bancadaFilter;
      const analise = analiseMap[d.id];
      const matchClass = classFilter === "all" || analise?.classificacao === classFilter;
      const score = analise ? Number(analise.score) : -1;
      const matchScore = score < 0 || (score >= scoreRange[0] && score <= scoreRange[1]);
      return matchName && matchParty && matchUf && matchBancada && matchClass && matchScore;
    });

    result.sort((a, b) => {
      const aA = analiseMap[a.id];
      const bA = analiseMap[b.id];
      switch (sortBy) {
        case "score-desc": return (Number(bA?.score ?? -1)) - (Number(aA?.score ?? -1));
        case "score-asc": return (Number(aA?.score ?? 999)) - (Number(bA?.score ?? 999));
        case "partido": return (a.siglaPartido || "").localeCompare(b.siglaPartido || "");
        case "uf": return (a.siglaUf || "").localeCompare(b.siglaUf || "");
        default: return a.nome.localeCompare(b.nome);
      }
    });

    return result;
  }, [deputados, searchTerm, partyFilter, ufFilter, bancadaFilter, classFilter, scoreRange, sortBy, analiseMap]);

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

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-3 space-y-4">
          <StatsPanel
            analises={analises} totalDeputados={deputados.length}
            syncing={syncing} onSync={handleSync} user={user}
            lastSync={lastSync} canSync={canSync} remainingSeconds={remainingSeconds}
            syncEvents={syncRun.events} syncStatus={syncRun.status} syncError={syncRun.error}
          />
          {user && (
            <Button variant="outline" className="w-full" onClick={() => exportAnalisesCsv(analises, ano)} disabled={analises.length === 0}>
              <Download size={14} className="mr-2" /> Exportar CSV
            </Button>
          )}
        </aside>

        <section className="xl:col-span-9 space-y-4">
          <Tabs defaultValue="deputados">
            <TabsList>
              <TabsTrigger value="deputados" className="gap-2"><Users size={14} /> Deputados</TabsTrigger>
              <TabsTrigger value="ranking" className="gap-2"><Trophy size={14} /> Ranking</TabsTrigger>
              <TabsTrigger value="partidos" className="gap-2"><BarChart2 size={14} /> Partidos</TabsTrigger>
              <TabsTrigger value="comparativo" className="gap-2"><GitCompareArrows size={14} /> Comparativo</TabsTrigger>
              <TabsTrigger value="tendencias" className="gap-2"><Target size={14} /> Tendências</TabsTrigger>
            </TabsList>

            <TabsContent value="deputados" className="space-y-4 mt-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={20} className="text-destructive" />
                  <p className="text-sm font-medium text-destructive">{error}</p>
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
              />
              <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-primary" /> {filteredDeputies.length} deputados
                </h2>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-widest">{ano}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
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
                <div className="py-16 text-center bg-card rounded-2xl border-2 border-dashed border-border">
                  <Search size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-semibold text-sm">Nenhum deputado encontrado</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ranking" className="mt-4"><RankingTable analises={analises} /></TabsContent>
            <TabsContent value="partidos" className="mt-4"><PartyChart analises={analises} /></TabsContent>
            <TabsContent value="comparativo" className="mt-4">
              <ComparisonView analises={analises} onDeputyClick={(id) => navigate(`/deputado/${id}`)} />
            </TabsContent>
            <TabsContent value="tendencias" className="mt-4">
              <CentroTrendsCamara analises={analises} ano={ano} onDeputadoClick={(id) => navigate(`/deputado/${id}`)} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="text-center py-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
          Monitor Legislativo • Transparência • {ano}
        </p>
      </footer>
    </div>
  );
};

export default Index;
