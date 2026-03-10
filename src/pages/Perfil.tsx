import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Users, Search, LogIn, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { DeputyCard } from "@/components/DeputyCard";
import { SenadorCard } from "@/components/SenadorCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useDeputados } from "@/hooks/useDeputados";
import { useSenadores } from "@/hooks/useSenadores";
import { useAnalises } from "@/hooks/useAnalises";
import { useAnalisesSenado } from "@/hooks/useAnalisesSenado";
import { useAuth } from "@/hooks/useAuth";
import { useFavoritos } from "@/hooks/useFavoritos";

const Perfil = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");

  const { user, signInWithGoogle, signOut } = useAuth();
  const { deputados, partidos } = useDeputados();
  const { senadores } = useSenadores();
  const { analises: analisesCamara } = useAnalises(ano);
  const { analises: analisesSenado } = useAnalisesSenado(ano);
  const { favoritos, toggleFavorito, isFavorito } = useFavoritos(user?.id);

  const analiseMapCamara = useMemo(() => {
    const map: Record<number, (typeof analisesCamara)[0]> = {};
    analisesCamara.forEach((a) => { map[a.deputado_id] = a; });
    return map;
  }, [analisesCamara]);

  const analiseMapSenado = useMemo(() => {
    const map: Record<number, (typeof analisesSenado)[0]> = {};
    analisesSenado.forEach((a) => { map[a.senador_id] = a; });
    return map;
  }, [analisesSenado]);

  const favDeputados = useMemo(() =>
    deputados.filter((d) => favoritos.includes(d.id)),
    [deputados, favoritos]
  );

  const favSenadores = useMemo(() =>
    senadores.filter((s) => favoritos.includes(s.id)),
    [senadores, favoritos]
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar
          searchTerm="" onSearchChange={() => {}} partyFilter="all" onPartyFilterChange={() => {}}
          ano={ano} onAnoChange={setAno} classFilter="all" onClassFilterChange={() => {}}
          partidos={[]} loading={false} onRefresh={() => {}} user={null}
          onSignIn={signInWithGoogle} onSignOut={signOut}
        />
        <div className="max-w-md mx-auto mt-20 text-center space-y-6 p-6">
          <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto">
            <LogIn size={32} className="text-primary" />
          </div>
          <h2 className="text-xl font-black text-foreground">Faça login para acessar seu perfil</h2>
          <p className="text-sm text-muted-foreground">
            Com uma conta você pode favoritar parlamentares e acompanhar de perto.
          </p>
          <Button onClick={signInWithGoogle} size="lg" className="gap-2">
            <LogIn size={18} /> Entrar com Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        partyFilter={partyFilter} onPartyFilterChange={setPartyFilter}
        ano={ano} onAnoChange={setAno}
        classFilter={classFilter} onClassFilterChange={setClassFilter}
        partidos={partidos} loading={false} onRefresh={() => {}}
        user={user} onSignIn={signInWithGoogle} onSignOut={signOut}
      />

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* User info card */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                className="w-16 h-16 rounded-2xl border-2 border-primary/20"
              />
            )}
            <div>
              <h2 className="text-lg font-black text-foreground">
                {user.user_metadata?.full_name || user.email}
              </h2>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Heart size={14} className="text-destructive fill-destructive" />
                <span className="text-xs font-bold text-muted-foreground">
                  {favoritos.length} favorito(s)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Favorites */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Heart size={16} className="text-destructive" /> Meus Favoritos
          </h3>

          {favoritos.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="py-16 text-center">
                <Heart size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-semibold text-sm">
                  Você ainda não favoritou nenhum parlamentar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clique no ♥ nos cards de deputados ou senadores para adicioná-los aqui
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                    <Users size={14} className="mr-2" /> Ver Deputados
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/senado")}>
                    <Users size={14} className="mr-2" /> Ver Senadores
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="deputados">
              <TabsList>
                <TabsTrigger value="deputados" className="gap-2">
                  Deputados ({favDeputados.length})
                </TabsTrigger>
                <TabsTrigger value="senadores" className="gap-2">
                  Senadores ({favSenadores.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deputados" className="mt-4">
                {favDeputados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum deputado favoritado</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {favDeputados.map((dep) => (
                      <DeputyCard
                        key={dep.id}
                        deputado={dep}
                        analise={analiseMapCamara[dep.id]}
                        onClick={() => navigate(`/deputado/${dep.id}`)}
                        isFavorito={true}
                        onToggleFavorito={toggleFavorito}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="senadores" className="mt-4">
                {favSenadores.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum senador favoritado</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {favSenadores.map((sen) => (
                      <SenadorCard
                        key={sen.id}
                        senador={sen}
                        analise={analiseMapSenado[sen.id]}
                        onClick={() => navigate(`/senador/${sen.id}`)}
                        isFavorito={true}
                        onToggleFavorito={toggleFavorito}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default Perfil;
