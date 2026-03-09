import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  AlertTriangle,
  Download,
  BarChart2,
  Trophy,
  GitCompareArrows,
  Target,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatsPanelSenado } from "@/components/StatsPanelSenado";
import { SenadorCard } from "@/components/SenadorCard";
import { RankingTableSenado } from "@/components/RankingTableSenado";
import { PartyChartSenado } from "@/components/PartyChartSenado";
import { ComparisonViewSenado } from "@/components/ComparisonViewSenado";
import { ClassificationFilterSenado } from "@/components/ClassificationFilterSenado";
import { CentroTrendsSenado } from "@/components/CentroTrendsSenado";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSenadores } from "@/hooks/useSenadores";
import { useAnalisesSenado } from "@/hooks/useAnalisesSenado";
import { useAuth } from "@/hooks/useAuth";
import { exportAnalisesSenadorCsv } from "@/lib/exportCsvSenado";

const Senado = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");

  const { senadores, partidos, loading: senLoading } = useSenadores();
  const {
    analises,
    loading: analLoading,
    syncing,
    error,
    syncSenadores,
    refetch,
  } = useAnalisesSenado(ano);
  const { user, signInWithGoogle, signOut } = useAuth();

  const analiseMap = useMemo(() => {
    const map: Record<number, (typeof analises)[0]> = {};
    analises.forEach((a) => {
      map[a.senador_id] = a;
    });
    return map;
  }, [analises]);

  const filteredSenadores = useMemo(() => {
    return senadores.filter((s) => {
      const matchName = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchParty = partyFilter === "all" ? true : s.siglaPartido === partyFilter;
      const matchClass =
        classFilter === "all"
          ? true
          : analiseMap[s.id]?.classificacao === classFilter;
      return matchName && matchParty && (classFilter === "all" || matchClass);
    });
  }, [senadores, searchTerm, partyFilter, classFilter, analiseMap]);

  // Adapt partidos to match Navbar expected type
  const partidosForNavbar = partidos.map((p, i) => ({ id: i, sigla: p.sigla, nome: p.sigla }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        partyFilter={partyFilter}
        onPartyFilterChange={setPartyFilter}
        ano={ano}
        onAnoChange={setAno}
        classFilter={classFilter}
        onClassFilterChange={setClassFilter}
        partidos={partidosForNavbar}
        loading={senLoading || analLoading}
        onRefresh={refetch}
        user={user}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
        casa="senado"
      />

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-3 space-y-4">
          <StatsPanelSenado
            analises={analises}
            totalSenadores={senadores.length}
            syncing={syncing}
            onSync={() => syncSenadores()}
          />
          {user && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => exportAnalisesSenadorCsv(analises, ano)}
              disabled={analises.length === 0}
            >
              <Download size={14} className="mr-2" />
              Exportar CSV
            </Button>
          )}
        </aside>

        <section className="xl:col-span-9 space-y-4">
          <Tabs defaultValue="senadores">
            <TabsList>
              <TabsTrigger value="senadores" className="gap-2">
                <Users size={14} /> Senadores
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-2">
                <Trophy size={14} /> Ranking
              </TabsTrigger>
              <TabsTrigger value="partidos" className="gap-2">
                <BarChart2 size={14} /> Partidos
              </TabsTrigger>
              <TabsTrigger value="comparativo" className="gap-2">
                <GitCompareArrows size={14} /> Comparativo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="senadores" className="space-y-4 mt-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={20} className="text-destructive" />
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
              )}

              <ClassificationFilterSenado
                analises={analises}
                classFilter={classFilter}
                onClassFilterChange={setClassFilter}
              />

              <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  {filteredSenadores.length} senadores
                </h2>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-widest">
                  {ano}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredSenadores.map((sen) => (
                  <SenadorCard
                    key={sen.id}
                    senador={sen}
                    analise={analiseMap[sen.id]}
                    onClick={() => navigate(`/senador/${sen.id}`)}
                  />
                ))}
              </div>

              {!senLoading && filteredSenadores.length === 0 && (
                <div className="py-16 text-center bg-card rounded-2xl border-2 border-dashed border-border">
                  <Search size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-semibold text-sm">
                    Nenhum senador encontrado
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ranking" className="mt-4">
              <RankingTableSenado analises={analises} />
            </TabsContent>

            <TabsContent value="partidos" className="mt-4">
              <PartyChartSenado analises={analises} />
            </TabsContent>

            <TabsContent value="comparativo" className="mt-4">
              <ComparisonViewSenado analises={analises} onSenadorClick={(id) => navigate(`/senador/${id}`)} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="text-center py-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
          Monitor Legislativo • Senado • {ano}
        </p>
      </footer>
    </div>
  );
};

export default Senado;
