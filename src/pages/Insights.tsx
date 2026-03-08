import { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { useInsightsData } from "@/hooks/useInsightsData";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

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
  const { deputados, senadores, votacoesCamara, votacoesSenado, loading } = useInsightsData(ano);
  const { user, signInWithGoogle, signOut } = useAuth();

  // 1. Classification distribution
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

  // 2. Average alignment by party (both houses)
  const partyComparison = useMemo(() => {
    const camMap: Record<string, { sum: number; count: number }> = {};
    const senMap: Record<string, { sum: number; count: number }> = {};
    deputados.forEach((d) => {
      if (!d.deputado_partido) return;
      const p = d.deputado_partido;
      camMap[p] = camMap[p] || { sum: 0, count: 0 };
      camMap[p].sum += Number(d.score);
      camMap[p].count++;
    });
    senadores.forEach((s) => {
      if (!s.senador_partido) return;
      const p = s.senador_partido;
      senMap[p] = senMap[p] || { sum: 0, count: 0 };
      senMap[p].sum += Number(s.score);
      senMap[p].count++;
    });
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
  }, [deputados, senadores]);

  // 3. Top/Bottom 10
  const topBottom = useMemo(() => {
    const all = [
      ...deputados.map((d) => ({ nome: d.deputado_nome, score: Number(d.score), casa: "Câmara", partido: d.deputado_partido })),
      ...senadores.map((s) => ({ nome: s.senador_nome, score: Number(s.score), casa: "Senado", partido: s.senador_partido })),
    ].filter((x) => x.score > 0);
    const sorted = [...all].sort((a, b) => b.score - a.score);
    return {
      top10: sorted.slice(0, 10),
      bottom10: sorted.slice(-10).reverse(),
    };
  }, [deputados, senadores]);

  // 4. Histogram
  const histogram = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${i * 10 + 10}`,
      camara: 0,
      senado: 0,
    }));
    deputados.forEach((d) => {
      const idx = Math.min(Math.floor(Number(d.score) / 10), 9);
      bins[idx].camara++;
    });
    senadores.forEach((s) => {
      const idx = Math.min(Math.floor(Number(s.score) / 10), 9);
      bins[idx].senado++;
    });
    return bins;
  }, [deputados, senadores]);

  // 5. UF heatmap
  const ufData = useMemo(() => {
    const camUf: Record<string, { sum: number; count: number }> = {};
    const senUf: Record<string, { sum: number; count: number }> = {};
    deputados.forEach((d) => {
      if (!d.deputado_uf) return;
      camUf[d.deputado_uf] = camUf[d.deputado_uf] || { sum: 0, count: 0 };
      camUf[d.deputado_uf].sum += Number(d.score);
      camUf[d.deputado_uf].count++;
    });
    senadores.forEach((s) => {
      if (!s.senador_uf) return;
      senUf[s.senador_uf] = senUf[s.senador_uf] || { sum: 0, count: 0 };
      senUf[s.senador_uf].sum += Number(s.score);
      senUf[s.senador_uf].count++;
    });
    return UFS.map((uf) => ({
      uf,
      camara: camUf[uf] ? Math.round(camUf[uf].sum / camUf[uf].count) : null,
      senado: senUf[uf] ? Math.round(senUf[uf].sum / senUf[uf].count) : null,
    })).filter((x) => x.camara !== null || x.senado !== null);
  }, [deputados, senadores]);

  // 6. Party divergence
  const partyDivergence = useMemo(() => {
    const camMap: Record<string, { sum: number; count: number }> = {};
    const senMap: Record<string, { sum: number; count: number }> = {};
    deputados.forEach((d) => {
      if (!d.deputado_partido) return;
      camMap[d.deputado_partido] = camMap[d.deputado_partido] || { sum: 0, count: 0 };
      camMap[d.deputado_partido].sum += Number(d.score);
      camMap[d.deputado_partido].count++;
    });
    senadores.forEach((s) => {
      if (!s.senador_partido) return;
      senMap[s.senador_partido] = senMap[s.senador_partido] || { sum: 0, count: 0 };
      senMap[s.senador_partido].sum += Number(s.score);
      senMap[s.senador_partido].count++;
    });
    const parties = Object.keys(camMap).filter((p) => senMap[p]);
    return parties
      .map((p) => {
        const cam = Math.round(camMap[p].sum / camMap[p].count);
        const sen = Math.round(senMap[p].sum / senMap[p].count);
        return { partido: p, camara: cam, senado: sen, divergencia: Math.abs(cam - sen) };
      })
      .sort((a, b) => b.divergencia - a.divergencia)
      .slice(0, 10);
  }, [deputados, senadores]);

  // 7. Volume by month
  const volumeByMonth = useMemo(() => {
    const months: Record<string, { camara: number; senado: number }> = {};
    const addMonth = (dateStr: string | null, casa: "camara" | "senado") => {
      if (!dateStr) return;
      const m = dateStr.substring(0, 7); // YYYY-MM
      months[m] = months[m] || { camara: 0, senado: 0 };
      months[m][casa]++;
    };
    votacoesCamara.forEach((v) => addMonth(v.data, "camara"));
    votacoesSenado.forEach((v) => addMonth(v.data, "senado"));
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, ...v }));
  }, [votacoesCamara, votacoesSenado]);

  const getHeatColor = (val: number | null) => {
    if (val === null) return "hsl(var(--muted))";
    if (val >= 80) return "hsl(160, 84%, 39%)";
    if (val >= 60) return "hsl(160, 60%, 50%)";
    if (val >= 40) return "hsl(45, 80%, 55%)";
    if (val >= 20) return "hsl(20, 80%, 55%)";
    return "hsl(347, 77%, 50%)";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        searchTerm=""
        onSearchChange={() => {}}
        partyFilter="all"
        onPartyFilterChange={() => {}}
        ano={ano}
        onAnoChange={setAno}
        classFilter="all"
        onClassFilterChange={() => {}}
        partidos={[]}
        loading={loading}
        onRefresh={() => {}}
        user={user}
        onSignIn={signIn}
        onSignOut={signOut}
        casa="camara"
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Insights Legislativos</h2>
            <p className="text-sm text-muted-foreground">Análise comparativa Câmara vs Senado — {ano}</p>
          </div>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Classification Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Classificação — Câmara</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={classDistCamara} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {classDistCamara.map((entry) => (
                          <Cell key={entry.name} fill={CLASS_COLORS[entry.name] || "#999"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Classificação — Senado</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={classDistSenado} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {classDistSenado.map((entry) => (
                          <Cell key={entry.name} fill={CLASS_COLORS[entry.name] || "#999"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* 2. Party Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Alinhamento Médio por Partido — Câmara vs Senado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(300, partyComparison.length * 35)}>
                  <BarChart data={partyComparison} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="partido" width={55} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="camara" name="Câmara" fill={CAMARA_COLOR} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="senado" name="Senado" fill={SENADO_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 3. Top / Bottom 10 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top 10 — Mais Alinhados</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={topBottom.top10} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="nome" width={95} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number, _: string, props: any) => [`${v}% (${props.payload.casa})`, "Score"]} />
                      <Bar dataKey="score" fill={SENADO_COLOR} radius={[0, 4, 4, 0]}>
                        {topBottom.top10.map((d, i) => (
                          <Cell key={i} fill={d.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top 10 — Menos Alinhados</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={topBottom.bottom10} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="nome" width={95} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number, _: string, props: any) => [`${v}% (${props.payload.casa})`, "Score"]} />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                        {topBottom.bottom10.map((d, i) => (
                          <Cell key={i} fill={d.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* 4. Histogram */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição de Scores (Histograma)</CardTitle>
              </CardHeader>
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

            {/* 5. UF Heatmap */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Alinhamento Médio por UF</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
                  {ufData.map((u) => (
                    <div key={u.uf} className="rounded-lg border border-border p-2 text-center space-y-1">
                      <span className="text-xs font-bold text-foreground">{u.uf}</span>
                      <div className="flex gap-1 justify-center">
                        <div
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: getHeatColor(u.camara), color: "#fff" }}
                          title="Câmara"
                        >
                          C: {u.camara ?? "—"}
                        </div>
                        <div
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: getHeatColor(u.senado), color: "#fff" }}
                          title="Senado"
                        >
                          S: {u.senado ?? "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 6. Party Divergence */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Partidos com Maior Divergência Câmara vs Senado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={partyDivergence} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="partido" width={55} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="camara" name="Câmara" fill={CAMARA_COLOR} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="senado" name="Senado" fill={SENADO_COLOR} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="divergencia" name="Divergência" fill="hsl(45, 80%, 55%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 7. Volume by Month */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Volume de Votações por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={volumeByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="camara" name="Câmara" stroke={CAMARA_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="senado" name="Senado" stroke={SENADO_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
