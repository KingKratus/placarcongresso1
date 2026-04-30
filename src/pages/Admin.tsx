import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Database, RefreshCcw, Users, AlertTriangle, Loader2, Trash2, BarChart2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { AdminBulkSync } from "@/components/AdminBulkSync";
import { AdminPerformanceSync } from "@/components/AdminPerformanceSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSyncRun } from "@/hooks/useSyncRun";
import { usePortalQuota } from "@/hooks/usePortalQuota";
import { SyncLogViewer } from "@/components/SyncLogViewer";

interface TableCount {
  table: string;
  count: number;
}

interface CoverageRow {
  ano: number;
  casa: string;
  total: number;
  sem_dados: number;
}

interface SyncRunRow {
  id: string;
  casa: string;
  ano: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  user_id: string | null;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signOut } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRunRow[]>([]);
  const [stuckCount, setStuckCount] = useState(0);
  const [cleaningStuck, setCleaningStuck] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [emendasSyncing, setEmendasSyncing] = useState(false);
  const [emendasAno, setEmendasAno] = useState(new Date().getFullYear());
  const [emendasTipo, setEmendasTipo] = useState<string>("");
  const [emendasAutor, setEmendasAutor] = useState("");
  const [emendasPaginas, setEmendasPaginas] = useState(3);
  const emendasRun = useSyncRun();
  const { quota, refresh: refreshQuota } = usePortalQuota();

  // Check admin role
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    const check = async () => {
      const { data } = await supabase.rpc("has_role", { _role: "admin" });
      setIsAdmin(!!data);
    };
    check();
  }, [user]);

  // Load dashboard data
  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoadingData(true);
    await Promise.all([loadTableCounts(), loadCoverage(), loadSyncRuns()]);
    setLoadingData(false);
  };

  const loadTableCounts = async () => {
    const tables = ["analises_deputados", "analises_senadores", "votacoes", "votacoes_senado", "votos_deputados", "votos_senadores", "orientacoes"];
    const counts: TableCount[] = [];
    for (const t of tables) {
      const { count } = await supabase.from(t as any).select("*", { count: "exact", head: true });
      counts.push({ table: t, count: count || 0 });
    }
    setTableCounts(counts);
  };

  const loadCoverage = async () => {
    const rows: CoverageRow[] = [];
    for (const ano of [2023, 2024, 2025, 2026]) {
      const { count: camTotal } = await supabase.from("analises_deputados").select("*", { count: "exact", head: true }).eq("ano", ano);
      const { count: camSemDados } = await supabase.from("analises_deputados").select("*", { count: "exact", head: true }).eq("ano", ano).eq("classificacao", "Sem Dados");
      rows.push({ ano, casa: "camara", total: camTotal || 0, sem_dados: camSemDados || 0 });

      const { count: senTotal } = await supabase.from("analises_senadores").select("*", { count: "exact", head: true }).eq("ano", ano);
      const { count: senSemDados } = await supabase.from("analises_senadores").select("*", { count: "exact", head: true }).eq("ano", ano).eq("classificacao", "Sem Dados");
      rows.push({ ano, casa: "senado", total: senTotal || 0, sem_dados: senSemDados || 0 });
    }
    setCoverage(rows);
  };

  const loadSyncRuns = async () => {
    const { data } = await supabase
      .from("sync_runs")
      .select("id, casa, ano, status, started_at, finished_at, error, user_id")
      .order("started_at", { ascending: false })
      .limit(100);
    const runs = (data || []) as SyncRunRow[];
    setSyncRuns(runs);

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const stuck = runs.filter(r => r.status === "running" && r.started_at < thirtyMinAgo);
    setStuckCount(stuck.length);
  };

  const syncEmendasOrcamentarias = async () => {
    setEmendasSyncing(true);
    emendasRun.reset();
    try {
      const payload: any = { ano: emendasAno, paginas: emendasPaginas, incluirDocumentos: false };
      if (emendasTipo) payload.tipoEmenda = emendasTipo;
      if (emendasAutor.trim()) payload.nomeAutor = emendasAutor.trim();
      const { data, error } = await supabase.functions.invoke("sync-emendas-transparencia", { body: payload });
      if (data?.runId) emendasRun.startRun(data.runId);
      if (error) {
        emendasRun.finishRun("error", error.message || "Falha ao sincronizar.");
      } else if (data?.error) {
        emendasRun.finishRun("error", data.error);
      } else {
        toast({ title: "Sync concluído", description: `${data?.upserted || 0} emendas atualizadas.` });
      }
      await Promise.all([loadData(), refreshQuota()]);
    } catch (e: any) {
      emendasRun.finishRun("error", e.message || "Erro ao sincronizar emendas $.");
    } finally {
      setEmendasSyncing(false);
    }
  };

  const cleanStuckRuns = async () => {
    setCleaningStuck(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "clean-stuck-runs" },
      });
      if (error) throw error;
      toast({ title: "Syncs presas limpas", description: `${data?.cleaned || 0} registros atualizados.` });
      await loadSyncRuns();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setCleaningStuck(false);
  };

  // Navbar dummy props
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-sm">
          <CardContent className="p-6 text-center space-y-4">
            <Shield size={48} className="mx-auto text-muted-foreground" />
            <p className="font-bold text-sm">Faça login para acessar o painel admin.</p>
            <Button onClick={signInWithGoogle}>Login com Google</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-sm">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle size={48} className="mx-auto text-destructive" />
            <p className="font-bold text-sm">Acesso negado. Apenas administradores podem acessar esta página.</p>
            <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "error": return "bg-destructive/10 text-destructive border-destructive/20";
      case "running": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusBreakdown = syncRuns.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        partyFilter={partyFilter} onPartyFilterChange={setPartyFilter}
        ano={ano} onAnoChange={setAno}
        classFilter={classFilter} onClassFilterChange={setClassFilter}
        partidos={[]} loading={loadingData}
        onRefresh={loadData} user={user} onSignIn={signInWithGoogle} onSignOut={signOut}
        casa="camara"
      />

      <main className="max-w-6xl mx-auto p-3 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary p-2 rounded-xl">
            <Shield className="text-primary-foreground" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wide">Painel Administrativo</h1>
            <p className="text-xs text-muted-foreground">Gerenciamento do sistema</p>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview" className="gap-1 text-xs"><Database size={12} /> Visão Geral</TabsTrigger>
            <TabsTrigger value="syncs" className="gap-1 text-xs"><RefreshCcw size={12} /> Syncs</TabsTrigger>
            <TabsTrigger value="data" className="gap-1 text-xs"><BarChart2 size={12} /> Dados</TabsTrigger>
            <TabsTrigger value="users" className="gap-1 text-xs"><Users size={12} /> Usuários</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tableCounts.map((tc) => (
                <Card key={tc.table}>
                  <CardContent className="p-3 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{tc.table.replace("analises_", "").replace("votos_", "v_").replace("votacoes_", "vt_")}</p>
                    <p className="text-xl font-black text-foreground mt-1">{tc.count.toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Sync Runs (status)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(statusBreakdown).map(([status, count]) => (
                  <Badge key={status} variant="outline" className={statusColor(status)}>
                    {status}: {count}
                  </Badge>
                ))}
                {stuckCount > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {stuckCount} presas (&gt;30min)
                  </Badge>
                )}
              </CardContent>
            </Card>

            {stuckCount > 0 && (
              <Button variant="destructive" onClick={cleanStuckRuns} disabled={cleaningStuck} className="gap-2">
                {cleaningStuck ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Limpar {stuckCount} sync(s) presa(s)
              </Button>
            )}
          </TabsContent>

          {/* SYNCS */}
          <TabsContent value="syncs" className="space-y-4 mt-4">
            <AdminBulkSync userId={user.id} />

            <AdminPerformanceSync ano={ano} />

            {quota && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest">Cota do Portal da Transparência (hoje)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span><b>{quota.used}</b>/{quota.limit} requisições usadas</span>
                    <span className="text-muted-foreground">{quota.limit - quota.used} restantes</span>
                  </div>
                  <Progress value={(quota.used / quota.limit) * 100} className="h-2" />
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground pt-1">
                    <Badge variant="outline" className="text-[9px]">Cache: {quota.cacheTotal} entradas</Badge>
                    <Badge variant="outline" className="text-[9px] bg-blue-500/5">Hits 24h: {quota.cacheHits24h}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Sync manual de Emendas $</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select className="h-9 rounded-md border bg-background px-3 text-xs" value={emendasAno} onChange={(e) => setEmendasAno(Number(e.target.value))}>
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2, new Date().getFullYear() - 3].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="h-9 rounded-md border bg-background px-3 text-xs" value={emendasTipo} onChange={(e) => setEmendasTipo(e.target.value)}>
                    <option value="">Todos os tipos</option>
                    <option value="Individual">Individual</option>
                    <option value="Bancada">Bancada</option>
                    <option value="Comissão">Comissão</option>
                    <option value="Relator">Relator</option>
                    <option value="Pix">Especial (PIX)</option>
                  </select>
                  <input className="h-9 rounded-md border bg-background px-3 text-xs flex-1 min-w-[160px]" placeholder="Filtrar por autor (opcional)" value={emendasAutor} onChange={(e) => setEmendasAutor(e.target.value)} />
                  <select className="h-9 rounded-md border bg-background px-3 text-xs" value={emendasPaginas} onChange={(e) => setEmendasPaginas(Number(e.target.value))}>
                    {[1, 2, 3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} pág.</option>)}
                  </select>
                  <Button size="sm" onClick={syncEmendasOrcamentarias} disabled={emendasSyncing} className="gap-2">
                    {emendasSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                    Sincronizar emendas $
                  </Button>
                </div>
                <SyncLogViewer
                  events={emendasRun.events}
                  status={emendasRun.status}
                  error={emendasRun.error}
                  onRetry={syncEmendasOrcamentarias}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Histórico Completo (últimas 100)</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[60vh] overflow-y-auto space-y-1">
                {syncRuns.map((r) => (
                  <div key={r.id} className={`flex items-center gap-2 p-2 rounded-lg text-[11px] border ${statusColor(r.status)}`}>
                    <Badge variant="outline" className="text-[9px] font-black uppercase">
                      {r.casa === "camara" ? "CÂM" : "SEN"}
                    </Badge>
                    <span className="font-bold">{r.ano}</span>
                    <Badge variant="outline" className={`text-[9px] ${statusColor(r.status)}`}>{r.status}</Badge>
                    <span className="text-muted-foreground text-[10px] flex-1 truncate">
                      {new Date(r.started_at).toLocaleString("pt-BR")}
                    </span>
                    {r.error && <span className="text-destructive truncate max-w-32">{r.error}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DATA COVERAGE */}
          <TabsContent value="data" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Cobertura por Ano/Casa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coverage.map((c) => {
                    const pct = c.total > 0 ? Math.round(((c.total - c.sem_dados) / c.total) * 100) : 0;
                    return (
                      <div key={`${c.ano}-${c.casa}`} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                        <Badge variant="outline" className="text-[9px] font-black uppercase shrink-0">
                          {c.casa === "camara" ? "CÂM" : "SEN"} {c.ano}
                        </Badge>
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-bold">{c.total} registros</span>
                            <span className="text-muted-foreground">{c.sem_dados} sem dados</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-xs font-black">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Gestão de Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  A gestão de roles de usuário é feita diretamente no banco de dados via tabela <code>user_roles</code>.
                  Em breve: interface para adicionar/remover admins.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
