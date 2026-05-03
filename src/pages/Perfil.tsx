import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Users, LogIn, Key, Copy, Check, Trash2, Plus, ExternalLink, Bot } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { DeputyCard } from "@/components/DeputyCard";
import { SenadorCard } from "@/components/SenadorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDeputados } from "@/hooks/useDeputados";
import { useSenadores } from "@/hooks/useSenadores";
import { useAnalises } from "@/hooks/useAnalises";
import { useAnalisesSenado } from "@/hooks/useAnalisesSenado";
import { useAuth } from "@/hooks/useAuth";
import { useFavoritos } from "@/hooks/useFavoritos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EmendasSyncCard } from "@/components/EmendasSyncCard";

const Perfil = () => {
  const navigate = useNavigate();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [isAdmin, setIsAdmin] = useState(false);

  const { user, signInWithGoogle, signOut } = useAuth();
  const { deputados, partidos } = useDeputados();
  const { senadores } = useSenadores();
  const { analises: analisesCamara } = useAnalises(ano);
  const { analises: analisesSenado } = useAnalisesSenado(ano);
  const { favoritos, toggleFavorito, isFavorito } = useFavoritos(user?.id);

  // API Keys
  const [apiKeys, setApiKeys] = useState<{ id: string; api_key: string; name: string; is_active: boolean; created_at: string }[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [customAiKey, setCustomAiKey] = useState(() => localStorage.getItem("custom_ai_key") || "");
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("custom_ai_provider") || "openai");

  const fetchApiKeys = useCallback(async () => {
    if (!user) return;
    setLoadingKeys(true);
    const { data } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    setApiKeys((data as any[]) || []);
    setLoadingKeys(false);
  }, [user]);

  // Fetch API keys on mount
  useEffect(() => { if (user) fetchApiKeys(); }, [user, fetchApiKeys]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const generateApiKey = useCallback(async () => {
    if (!user) return;
    const key = `pk_${crypto.randomUUID().replace(/-/g, "")}`;
    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      api_key: key,
      name: newKeyName || "Minha API Key",
    } as any);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível gerar a chave.", variant: "destructive" });
    } else {
      toast({ title: "Chave gerada!", description: "Copie a chave e guarde em local seguro." });
      setNewKeyName("");
      fetchApiKeys();
    }
  }, [user, newKeyName, fetchApiKeys]);

  const deleteApiKey = useCallback(async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    fetchApiKeys();
  }, [fetchApiKeys]);

  const copyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

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
            Com uma conta você pode favoritar parlamentares e gerar chaves de API.
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
        searchTerm="" onSearchChange={() => {}}
        partyFilter="all" onPartyFilterChange={() => {}}
        ano={ano} onAnoChange={setAno}
        classFilter="all" onClassFilterChange={() => {}}
        partidos={partidos} loading={false} onRefresh={() => {}}
        user={user} onSignIn={signInWithGoogle} onSignOut={signOut}
      />

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* User info */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            {user.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="Avatar"
                className="w-16 h-16 rounded-2xl border-2 border-primary/20" />
            )}
            <div>
              <h2 className="text-lg font-black text-foreground">
                {user.user_metadata?.full_name || user.email}
              </h2>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <Heart size={14} className="text-destructive fill-destructive" />
                  <span className="text-xs font-bold text-muted-foreground">{favoritos.length} favorito(s)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Key size={14} className="text-primary" />
                  <span className="text-xs font-bold text-muted-foreground">{apiKeys.length} chave(s)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Key size={16} className="text-primary" /> API Keys
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Gere chaves para acessar dados via API em outras aplicações.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da chave (ex: Meu App)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1 h-9 text-sm"
              />
              <Button size="sm" onClick={generateApiKey} className="gap-1">
                <Plus size={14} /> Gerar Chave
              </Button>
            </div>

            {apiKeys.length > 0 && (
              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{k.name}</p>
                      <code className="text-[10px] text-muted-foreground font-mono block truncate">{k.api_key}</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Criada em {new Date(k.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => copyKey(k.api_key)}
                    >
                      {copiedKey === k.api_key ? <Check size={14} className="text-governo" /> : <Copy size={14} />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => deleteApiKey(k.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
              <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1">
                <ExternalLink size={12} /> Documentação da API
              </h4>

              {/* Authentication */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-foreground">1. Autenticação</p>
                <p className="text-[10px] text-muted-foreground">
                  Inclua sua chave no header <code className="bg-muted px-1 rounded">Authorization</code>:
                </p>
                <code className="bg-muted px-2 py-1 rounded text-[10px] block font-mono">
                  Authorization: Bearer pk_sua_chave_aqui
                </code>
              </div>

              {/* Base URL */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-foreground">2. URL Base</p>
                <code className="bg-muted px-2 py-1 rounded text-[10px] block font-mono break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-dados
                </code>
              </div>

              {/* Parameters */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-foreground">3. Parâmetros</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-muted-foreground">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 pr-2 font-bold text-foreground">Param</th>
                        <th className="text-left py-1 pr-2 font-bold text-foreground">Valores</th>
                        <th className="text-left py-1 font-bold text-foreground">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr className="border-b border-border/50">
                        <td className="py-1 pr-2"><code className="bg-muted px-1 rounded">casa</code></td>
                        <td className="py-1 pr-2">camara | senado</td>
                        <td className="py-1 font-sans">Casa legislativa</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-1 pr-2"><code className="bg-muted px-1 rounded">ano</code></td>
                        <td className="py-1 pr-2">2023-2026</td>
                        <td className="py-1 font-sans">Ano da análise</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-1 pr-2"><code className="bg-muted px-1 rounded">tipo</code></td>
                        <td className="py-1 pr-2">analises | votacoes | votos</td>
                        <td className="py-1 font-sans">Tipo de dados</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-2"><code className="bg-muted px-1 rounded">partido</code></td>
                        <td className="py-1 pr-2">PT, PL, etc.</td>
                        <td className="py-1 font-sans">Filtro opcional por partido</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Examples */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-foreground">4. Exemplos</p>
                <div className="space-y-1.5">
                  <div>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase">Rankings de deputados 2025:</p>
                    <code className="bg-muted px-2 py-1 rounded text-[9px] block font-mono break-all mt-0.5">
                      curl -H "Authorization: Bearer SUA_KEY" "{import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-dados?casa=camara&ano=2025&tipo=analises"
                    </code>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase">Votações do senado 2024:</p>
                    <code className="bg-muted px-2 py-1 rounded text-[9px] block font-mono break-all mt-0.5">
                      curl -H "Authorization: Bearer SUA_KEY" "{import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-dados?casa=senado&ano=2024&tipo=votacoes"
                    </code>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase">Votos individuais do PT na câmara:</p>
                    <code className="bg-muted px-2 py-1 rounded text-[9px] block font-mono break-all mt-0.5">
                      curl -H "Authorization: Bearer SUA_KEY" "{import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-dados?casa=camara&ano=2025&tipo=votos&partido=PT"
                    </code>
                  </div>
                </div>
              </div>

              {/* Response format */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-foreground">5. Formato de Resposta</p>
                <p className="text-[10px] text-muted-foreground">
                  Todas as respostas são JSON. O tipo <code className="bg-muted px-1 rounded">analises</code> retorna campos como:
                </p>
                <code className="bg-muted px-2 py-1 rounded text-[9px] block font-mono whitespace-pre">{`{
  "deputado_nome": "...",
  "deputado_partido": "PT",
  "score": 97.5,
  "classificacao": "Governo",
  "votos_alinhados": 39,
  "total_votos": 40
}`}</code>
              </div>

              {/* Rate limits */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-foreground">6. Limites</p>
                <p className="text-[10px] text-muted-foreground">
                  Máximo de 1000 registros por requisição. Para datasets maiores, filtre por partido ou ano específico.
                  Não há limite de requisições por hora, mas use com responsabilidade.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom AI Key */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Bot size={16} className="text-primary" /> Chave de IA Própria
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Use sua própria chave de API para fazer perguntas ilimitadas à IA sobre os dados públicos da plataforma.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select
                className="h-9 text-xs rounded-md border border-input bg-background px-3"
                value={aiProvider}
                onChange={(e) => {
                  setAiProvider(e.target.value);
                  localStorage.setItem("custom_ai_provider", e.target.value);
                }}
              >
                <option value="openai">OpenAI (GPT)</option>
                <option value="google">Google (Gemini)</option>
              </select>
              <Input
                type="password"
                placeholder={aiProvider === "openai" ? "sk-..." : "AIza..."}
                value={customAiKey}
                onChange={(e) => setCustomAiKey(e.target.value)}
                className="flex-1 h-9 text-sm font-mono"
              />
              <Button
                size="sm"
                onClick={() => {
                  localStorage.setItem("custom_ai_key", customAiKey);
                  toast({ title: customAiKey ? "Chave salva!" : "Chave removida", description: customAiKey ? "O chat usará sua chave de IA." : "O chat voltará a usar o padrão." });
                }}
              >
                Salvar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              A chave é salva localmente no navegador e usada diretamente na edge function. Para remover, limpe o campo e salve.
            </p>
          </CardContent>
        </Card>

        {/* Sync de Emendas $ — admins */}
        {isAdmin && <EmendasSyncCard />}

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
