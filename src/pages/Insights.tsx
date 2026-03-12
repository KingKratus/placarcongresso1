import { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { useInsightsData } from "@/hooks/useInsightsData";
import { useAuth } from "@/hooks/useAuth";
import { AlignmentTrendChart } from "@/components/insights/AlignmentTrendChart";
import { AlignmentSimulation } from "@/components/insights/AlignmentSimulation";
import { ProjetosTab } from "@/components/insights/ProjetosTab";
import { BrazilMap } from "@/components/insights/BrazilMap";
import { AgendaAoVivo } from "@/components/insights/AgendaAoVivo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { TrendingUp, BarChart2, Map, GitCompareArrows, Activity, SlidersHorizontal, FileText, Radio } from "lucide-react";

const ANOS = [2023, 2024, 2025, 2026];
const CLASS_COLORS: Record<string, string> = {
  Governo: "hsl(160, 84%, 39%)",
  Oposição: "hsl(347, 77%, 50%)",
  Centro: "hsl(239, 84%, 67%)",
  "Sem Dados": "hsl(215, 16%, 47%)",
};
const CAMARA_COLOR = "hsl(239, 84%, 67%)";
const SENADO_COLOR = "hsl(160, 84%, 39%)";
const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export default function Insights() {
  const [ano, setAno] = useState(2025);
  const { deputados, senadores, votacoesCamara, votacoesSenado, allYearsDeputados, allYearsSenadores, loading } = useInsightsData(ano);
  const { user, signInWithGoogle, signOut } = useAuth();

  // Classification distribution
  const classDistCamara = useMemo(() => {
    const map: Record<string, number> = {};
    deputados.forEach((d) => { map[d.classificacao] = (map[d.classificacao] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [deputados]);

  const classDistSenado = useMemo(() => {
    const map: Record<string, number> = {};
    senadores.forEach((s) => { map[s.classificacao] = (map[s.classificacao] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [senadores]);

  const partyAggregation = useMemo(() => {
    const camMap: Record<string, { sum: number; count: number }> = {};
    const senMap: Record<string, { sum: number; count: number }> = {};
    deputados.forEach((d) => {
      if (!d.deputado_partido) return;
      const p = d.deputado_partido;
      camMap[p] = camMap[p] || { sum: 0, count: 0 };
      camMap[p].sum += Number(d.score); camMap[p].count++;
    });
    senadores.forEach((s) => {
      if (!s.senador_partido) return;
      const p = s.senador_partido;
      senMap[p] = senMap[p] || { sum: 0, count: 0 };
      senMap[p].sum += Number(s.score); senMap[p].count++;
    });
    return { camMap, senMap };
  }, [deputados, senadores]);

  const partyComparison = useMemo(() => {
    const { camMap, senMap } = partyAggregation;
    const allParties = new Set([...Object.keys(camMap), ...Object.keys(senMap)]);
    return Array.from(allParties)
      .map((p) => ({
        partido: p,
        camara: camMap[p] ? Math.round(camMap[p].sum / camMap[p].count) : 0,
        senado: senMap[p] ? Math.round(senMap[p].sum / senMap[p].count) : 0,
        hasBoth: !!camMap[p] && !!senMap[p],
      }))
      .filter((p) => p.hasBoth)
      .sort((a, b) => b.camara - a.camara)
      .slice(0, 15);
  }, [partyAggregation]);

  const topBottom = useMemo(() => {
    const all = [
      ...deputados.map((d) => ({ nome: d.deputado_nome, score: Number(d.score), casa: "Câmara", partido: d.deputado_partido })),
      ...senadores.map((s) => ({ nome: s.senador_nome, score: Number(s.score), casa: "Senado", partido: s.senador_partido })),
    ].filter((x) => x.score > 0);
    const sorted = [...all].sort((a, b) => b.score - a.score);
    return { top10: sorted.slice(0, 10), bottom10: sorted.slice(-10).reverse() };
  }, [deputados, senadores]);

  const histogram = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 10}`, camara: 0, senado: 0 }));
    deputados.forEach((d) => { bins[Math.min(Math.floor(Number(d.score) / 10), 9)].camara++; });
    senadores.forEach((s) => { bins[Math.min(Math.floor(Number(s.score) / 10), 9)].senado++; });
    return bins;
  }, [deputados, senadores]);

  // UF data with classifications
  const ufData = useMemo(() => {
    const camUf: Record<string, { sum: number; count: number; classes: Record<string, number> }> = {};
    const senUf: Record<string, { sum: number; count: number; classes: Record<string, number> }> = {};
    deputados.forEach((d) => {
      if (!d.deputado_uf) return;
      camUf[d.deputado_uf] = camUf[d.deputado_uf] || { sum: 0, count: 0, classes: {} };
      camUf[d.deputado_uf].sum += Number(d.score); camUf[d.deputado_uf].count++;
      camUf[d.deputado_uf].classes[d.classificacao] = (camUf[d.deputado_uf].classes[d.classificacao] || 0) + 1;
    });
    senadores.forEach((s) => {
      if (!s.senador_uf) return;
      senUf[s.senador_uf] = senUf[s.senador_uf] || { sum: 0, count: 0, classes: {} };
      senUf[s.senador_uf].sum += Number(s.score); senUf[s.senador_uf].count++;
      senUf[s.senador_uf].classes[s.classificacao] = (senUf[s.senador_uf].classes[s.classificacao] || 0) + 1;
    });

    const getMajorityClass = (classes: Record<string, number>) => {
      let max = 0, cls = "Sem Dados";
      for (const [k, v] of Object.entries(classes)) {
        if (v > max) { max = v; cls = k; }
      }
      return cls;
    };

    return UFS.map((uf) => ({
      uf,
      camara: camUf[uf] ? Math.round(camUf[uf].sum / camUf[uf].count) : null,
      senado: senUf[uf] ? Math.round(senUf[uf].sum / senUf[uf].count) : null,
      camaraClass: camUf[uf] ? getMajorityClass(camUf[uf].classes) : "Sem Dados",
      senadoClass: senUf[uf] ? getMajorityClass(senUf[uf].classes) : "Sem Dados",
    })).filter((x) => x.camara !== null || x.senado !== null);
  }, [deputados, senadores]);

  const partyDivergence = useMemo(() => {
    const { camMap, senMap } = partyAggregation;
    return Object.keys(camMap).filter((p) => senMap[p])
      .map((p) => {
        const cam = Math.round(camMap[p].sum / camMap[p].count);
        const sen = Math.round(senMap[p].sum / senMap[p].count);
        return { partido: p, camara: cam, senado: sen, divergencia: Math.abs(cam - sen) };
      })
      .sort((a, b) => b.divergencia - a.divergencia)
      .slice(0, 10);
  }, [partyAggregation]);

  const volumeByMonth = useMemo(() => {
    const months: Record<string, { camara: number; senado: number }> = {};
    const addMonth = (dateStr: string | null, casa: "camara" | "senado") => {
      if (!dateStr) return;
      const m = dateStr.substring(0, 7);
      months[m] = months[m] || { camara: 0, senado: 0 };
      months[m][casa]++;
    };
    votacoesCamara.forEach((v) => addMonth(v.data, "camara"));
    votacoesSenado.forEach((v) => addMonth(v.data, "senado"));
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, ...v }));
  }, [votacoesCamara, votacoesSenado]);

  const stats = useMemo(() => {
    const totalDep = deputados.length;
    const totalSen = senadores.length;
    const avgDep = totalDep > 0 ? deputados.reduce((s, d) => s + Number(d.score), 0) / totalDep : 0;
    const avgSen = totalSen > 0 ? senadores.reduce((s, d) => s + Number(d.score), 0) / totalSen : 0;
    return { totalDep, totalSen, avgDep, avgSen, totalVotCam: votacoesCamara.length, totalVotSen: votacoesSenado.length };
  }, [deputados, senadores, votacoesCamara, votacoesSenado]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        searchTerm="" onSearchChange={() => {}} partyFilter="all" onPartyFilterChange={() => {}}
        ano={ano} onAnoChange={setAno} classFilter="all" onClassFilterChange={() => {}}
        partidos={[]} loading={loading} onRefresh={() => {}}
        user={user} onSignIn={signInWithGoogle} onSignOut={signOut} casa="camara"
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Insights Legislativos</h2>
            <p className="text-sm text-muted-foreground">Análise comparativa Câmara vs Senado — {ano}</p>
          </div>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-black text-foreground">{stats.totalDep}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Deputados</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-black text-foreground">{stats.totalSen}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Senadores</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-black" style={{ color: CAMARA_COLOR }}>{stats.avgDep.toFixed(1)}%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Média Câmara</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-black" style={{ color: SENADO_COLOR }}>{stats.avgSen.toFixed(1)}%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Média Senado</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-black text-foreground">{stats.totalVotCam}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Votações Câmara</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-black text-foreground">{stats.totalVotSen}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Votações Senado</p>
            </CardContent></Card>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-lg" />)}
          </div>
        ) : (
          <Tabs defaultValue="visao-geral" className="space-y-4">
            <TabsList className="flex-wrap">
              <TabsTrigger value="visao-geral" className="gap-2"><TrendingUp size={14} /> Visão Geral</TabsTrigger>
              <TabsTrigger value="partidos" className="gap-2"><BarChart2 size={14} /> Partidos</TabsTrigger>
              <TabsTrigger value="estados" className="gap-2"><Map size={14} /> Estados</TabsTrigger>
              <TabsTrigger value="divergencia" className="gap-2"><GitCompareArrows size={14} /> Divergência</TabsTrigger>
              <TabsTrigger value="volume" className="gap-2"><Activity size={14} /> Volume</TabsTrigger>
              <TabsTrigger value="simulacao" className="gap-2"><SlidersHorizontal size={14} /> Simulação</TabsTrigger>
              <TabsTrigger value="projetos" className="gap-2"><FileText size={14} /> Projetos</TabsTrigger>
              <TabsTrigger value="ao-vivo" className="gap-2"><Radio size={14} /> Ao Vivo</TabsTrigger>
            </TabsList>

            {/* Visão Geral */}
            <TabsContent value="visao-geral" className="space-y-6">
              <AlignmentTrendChart allYearsDeputados={allYearsDeputados} allYearsSenadores={allYearsSenadores} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Classificação — Câmara</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={classDistCamara} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {classDistCamara.map((entry) => <Cell key={entry.name} fill={CLASS_COLORS[entry.name] || "#999"} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Classificação — Senado</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={classDistSenado} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {classDistSenado.map((entry) => <Cell key={entry.name} fill={CLASS_COLORS[entry.name] || "#999"} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Top 10 — Mais Alinhados</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={topBottom.top10} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="nome" width={95} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number, _: string, props: any) => [`${v}% (${props.payload.casa})`, "Score"]} />
                        <Bar dataKey="score" fill={SENADO_COLOR} radius={[0, 4, 4, 0]}>
                          {topBottom.top10.map((d, i) => <Cell key={i} fill={d.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Top 10 — Menos Alinhados</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={topBottom.bottom10} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="nome" width={95} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number, _: string, props: any) => [`${v}% (${props.payload.casa})`, "Score"]} />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                          {topBottom.bottom10.map((d, i) => <Cell key={i} fill={d.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Distribuição de Scores (Histograma)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={histogram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="camara" name="Câmara" fill={CAMARA_COLOR} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="senado" name="Senado" fill={SENADO_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Partidos */}
            <TabsContent value="partidos">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Alinhamento Médio por Partido — Câmara vs Senado</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(300, partyComparison.length * 35)}>
                    <BarChart data={partyComparison} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="partido" width={55} tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      <Bar dataKey="camara" name="Câmara" fill={CAMARA_COLOR} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="senado" name="Senado" fill={SENADO_COLOR} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Estados - Brazil Map */}
            <TabsContent value="estados">
              <BrazilMap ufData={ufData} />
            </TabsContent>

            {/* Divergência */}
            <TabsContent value="divergencia">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Partidos com Maior Divergência Câmara vs Senado</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={partyDivergence} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="partido" width={55} tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      <Bar dataKey="camara" name="Câmara" fill={CAMARA_COLOR} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="senado" name="Senado" fill={SENADO_COLOR} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="divergencia" name="Divergência" fill="hsl(45, 80%, 55%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Volume */}
            <TabsContent value="volume">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Volume de Votações por Mês</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={volumeByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip /><Legend />
                      <Line type="monotone" dataKey="camara" name="Câmara" stroke={CAMARA_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="senado" name="Senado" stroke={SENADO_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Simulação */}
            <TabsContent value="simulacao">
              <AlignmentSimulation allYearsDeputados={allYearsDeputados} allYearsSenadores={allYearsSenadores} />
            </TabsContent>

            {/* Projetos */}
            <TabsContent value="projetos">
              <ProjetosTab votacoesCamara={votacoesCamara} votacoesSenado={votacoesSenado} ano={ano} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
