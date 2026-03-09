import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VotacaoCamara, VotacaoSenado } from "@/hooks/useInsightsData";

const CAMARA_COLOR = "hsl(239, 84%, 67%)";
const SENADO_COLOR = "hsl(160, 84%, 39%)";
const CHART_COLORS = [
  "hsl(239, 84%, 67%)", "hsl(160, 84%, 39%)", "hsl(45, 80%, 55%)",
  "hsl(347, 77%, 50%)", "hsl(280, 60%, 55%)", "hsl(200, 70%, 50%)",
  "hsl(30, 80%, 55%)", "hsl(120, 50%, 45%)", "hsl(0, 60%, 50%)", "hsl(180, 60%, 40%)",
];

interface Props {
  votacoesCamara: VotacaoCamara[];
  votacoesSenado: VotacaoSenado[];
}

export function ProjetosTab({ votacoesCamara, votacoesSenado }: Props) {
  const [search, setSearch] = useState("");

  // Distribution by type (Câmara)
  const tiposCamara = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesCamara.forEach((v) => {
      const tipo = v.proposicao_tipo || "Outros";
      map[tipo] = (map[tipo] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [votacoesCamara]);

  // Distribution by type (Senado)
  const tiposSenado = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesSenado.forEach((v) => {
      const tipo = v.sigla_materia || "Outros";
      map[tipo] = (map[tipo] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [votacoesSenado]);

  // Senate results distribution
  const resultadosSenado = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesSenado.forEach((v) => {
      const r = v.resultado || "Sem resultado";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [votacoesSenado]);

  // Timeline by month
  const timeline = useMemo(() => {
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

  // Top órgãos Câmara
  const orgaosCamara = useMemo(() => {
    const map: Record<string, number> = {};
    votacoesCamara.forEach((v) => {
      const org = v.sigla_orgao || "Desconhecido";
      map[org] = (map[org] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [votacoesCamara]);

  // Searchable recent projects table
  const recentProjects = useMemo(() => {
    const term = search.toLowerCase();
    const all = [
      ...votacoesCamara.map((v) => ({
        casa: "Câmara" as const,
        tipo: v.proposicao_tipo || "—",
        numero: v.proposicao_numero || "—",
        ementa: v.proposicao_ementa || v.descricao || "—",
        data: v.data ? new Date(v.data).toLocaleDateString("pt-BR") : "—",
        resultado: "—",
      })),
      ...votacoesSenado.map((v) => ({
        casa: "Senado" as const,
        tipo: v.sigla_materia || "—",
        numero: v.numero_materia || "—",
        ementa: v.ementa || v.descricao || "—",
        data: v.data ? new Date(v.data).toLocaleDateString("pt-BR") : "—",
        resultado: v.resultado || "—",
      })),
    ];
    const filtered = term
      ? all.filter((p) =>
          p.ementa.toLowerCase().includes(term) ||
          p.tipo.toLowerCase().includes(term) ||
          p.numero.toLowerCase().includes(term) ||
          p.casa.toLowerCase().includes(term)
        )
      : all;
    return filtered.slice(0, 50);
  }, [votacoesCamara, votacoesSenado, search]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black" style={{ color: CAMARA_COLOR }}>{votacoesCamara.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Votações Câmara</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black" style={{ color: SENADO_COLOR }}>{votacoesSenado.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Votações Senado</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black text-foreground">{tiposCamara.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Tipos Câmara</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black text-foreground">{tiposSenado.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Tipos Senado</p>
        </CardContent></Card>
      </div>

      {/* Type distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tipo de Proposição — Câmara</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tiposCamara} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" name="Qtd" fill={CAMARA_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tipo de Matéria — Senado</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tiposSenado} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" name="Qtd" fill={SENADO_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Senate results + Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resultados — Senado</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={resultadosSenado} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={95}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {resultadosSenado.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Volume Mensal de Votações</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="camara" name="Câmara" stroke={CAMARA_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="senado" name="Senado" stroke={SENADO_COLOR} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Órgãos Câmara */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Órgãos/Comissões Mais Ativos — Câmara</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(250, orgaosCamara.length * 30)}>
            <BarChart data={orgaosCamara} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" name="Votações" fill={CAMARA_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent projects table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Projetos Recentes</CardTitle>
            <Input
              placeholder="Buscar por ementa, tipo ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Casa</TableHead>
                  <TableHead className="w-16">Tipo</TableHead>
                  <TableHead className="w-16">Nº</TableHead>
                  <TableHead>Ementa</TableHead>
                  <TableHead className="w-24">Data</TableHead>
                  <TableHead className="w-24">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentProjects.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum projeto encontrado</TableCell></TableRow>
                ) : (
                  recentProjects.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{
                          backgroundColor: p.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR,
                          color: "#fff",
                        }}>{p.casa === "Câmara" ? "CÂM" : "SEN"}</span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{p.tipo}</TableCell>
                      <TableCell className="text-xs">{p.numero}</TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate" title={p.ementa}>{p.ementa}</TableCell>
                      <TableCell className="text-xs">{p.data}</TableCell>
                      <TableCell className="text-xs">{p.resultado}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
