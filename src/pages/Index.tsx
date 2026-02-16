import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  AlertTriangle,
  Download,
  BarChart2,
  Trophy,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatsPanel } from "@/components/StatsPanel";
import { DeputyCard } from "@/components/DeputyCard";
import { RankingTable } from "@/components/RankingTable";
import { PartyChart } from "@/components/PartyChart";
import { ClassificationFilter } from "@/components/ClassificationFilter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeputados } from "@/hooks/useDeputados";
import { useAnalises } from "@/hooks/useAnalises";
import { useAuth } from "@/hooks/useAuth";
import { exportAnalisesCsv } from "@/lib/exportCsv";

const Index = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(2025);
  const [classFilter, setClassFilter] = useState("all");

  const { deputados, partidos, loading: depLoading } = useDeputados();
  const {
    analises,
    loading: analLoading,
    syncing,
    error,
    syncDeputados,
    refetch,
  } = useAnalises(ano);
  const { user, signInWithGoogle, signOut } = useAuth();

  const analiseMap = useMemo(() => {
    const map: Record<number, (typeof analises)[0]> = {};
    analises.forEach((a) => {
      map[a.deputado_id] = a;
    });
    return map;
  }, [analises]);

  const filteredDeputies = useMemo(() => {
    return deputados.filter((d) => {
      const matchName = d.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchParty = partyFilter === "all" ? true : d.siglaPartido === partyFilter;
      const matchClass =
        classFilter === "all"
          ? true
          : analiseMap[d.id]?.classificacao === classFilter;
      return matchName && matchParty && (classFilter === "all" || matchClass);
    });
  }, [deputados, searchTerm, partyFilter, classFilter, analiseMap]);

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
        partidos={partidos}
        loading={depLoading || analLoading}
        onRefresh={refetch}
        user={user}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-3 space-y-4">
          <StatsPanel
            analises={analises}
            totalDeputados={deputados.length}
            syncing={syncing}
            onSync={() => syncDeputados(50)}
          />
          {user && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => exportAnalisesCsv(analises, ano)}
              disabled={analises.length === 0}
            >
              <Download size={14} className="mr-2" />
              Exportar CSV
            </Button>
          )}
        </aside>

        <section className="xl:col-span-9 space-y-4">
          <Tabs defaultValue="deputados">
            <TabsList>
              <TabsTrigger value="deputados" className="gap-2">
                <Users size={14} /> Deputados
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-2">
                <Trophy size={14} /> Ranking
              </TabsTrigger>
              <TabsTrigger value="partidos" className="gap-2">
                <BarChart2 size={14} /> Partidos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deputados" className="space-y-4 mt-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={20} className="text-destructive" />
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
              )}

              {/* Classification filter with counters */}
              <ClassificationFilter
                analises={analises}
                classFilter={classFilter}
                onClassFilterChange={setClassFilter}
              />

              <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  {filteredDeputies.length} deputados
                </h2>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-widest">
                  {ano}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredDeputies.map((dep) => (
                  <DeputyCard
                    key={dep.id}
                    deputado={dep}
                    analise={analiseMap[dep.id]}
                    onClick={() => navigate(`/deputado/${dep.id}`)}
                  />
                ))}
              </div>

              {!depLoading && filteredDeputies.length === 0 && (
                <div className="py-16 text-center bg-card rounded-2xl border-2 border-dashed border-border">
                  <Search size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-semibold text-sm">
                    Nenhum deputado encontrado
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ranking" className="mt-4">
              <RankingTable analises={analises} />
            </TabsContent>

            <TabsContent value="partidos" className="mt-4">
              <PartyChart analises={analises} />
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
