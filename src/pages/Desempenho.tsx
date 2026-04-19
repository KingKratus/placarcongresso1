import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Download, Search, Trophy, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCustomWeights, applyWeights, type PerformanceScore } from "@/hooks/usePerformanceScore";
import { PerformanceWeightsCustomizer } from "@/components/PerformanceWeightsCustomizer";
import { PerformanceHistogram } from "@/components/PerformanceHistogram";
import { PerformanceCompare } from "@/components/PerformanceCompare";

const ANOS = [2023, 2024, 2025, 2026];

export default function Desempenho() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [casa, setCasa] = useState<"camara" | "senado">("camara");
  const [scores, setScores] = useState<PerformanceScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [partido, setPartido] = useState("all");
  const [uf, setUf] = useState("all");
  const { weights, update, reset, isDefault } = useCustomWeights();

  const reload = () => {
    setLoading(true);
    supabase
      .from("deputy_performance_scores")
      .select("*")
      .eq("casa", casa)
      .eq("ano", ano)
      .order("score_total", { ascending: false })
      .limit(600)
      .then(({ data }) => {
        setScores((data || []) as PerformanceScore[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, casa]);

  const partidos = useMemo(() => {
    const set = new Set<string>();
    scores.forEach((s) => s.partido && set.add(s.partido));
    return Array.from(set).sort();
  }, [scores]);

  const ufs = useMemo(() => {
    const set = new Set<string>();
    scores.forEach((s) => s.uf && set.add(s.uf));
    return Array.from(set).sort();
  }, [scores]);

  const computed = useMemo(() => {
    return scores.map((s) => ({
      ...s,
      score_custom: isDefault ? Number(s.score_total) : applyWeights(s, weights),
    }));
  }, [scores, weights, isDefault]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return computed
      .filter((s) => (partido === "all" ? true : s.partido === partido))
      .filter((s) => (uf === "all" ? true : s.uf === uf))
      .filter((s) => (q ? (s.nome || "").toLowerCase().includes(q) : true))
      .sort((a, b) => b.score_custom - a.score_custom);
  }, [computed, search, partido, uf]);

  const top10Threshold = useMemo(() => {
    if (filtered.length < 10) return Infinity;
    const sorted = [...filtered].map((s) => s.score_custom).sort((a, b) => b - a);
    return sorted[Math.floor(sorted.length * 0.1)];
  }, [filtered]);

  const exportCsv = () => {
    const header = "Posição,Nome,Partido,UF,Alinhamento,Presença,Impacto,Engajamento,Score Total";
    const rows = filtered.map((s, i) => [
      i + 1,
      `"${s.nome || ""}"`,
      s.partido || "",
      s.uf || "",
      Number(s.score_alinhamento).toFixed(2),
      Number(s.score_presenca).toFixed(2),
      Number(s.score_impacto).toFixed(2),
      Number(s.score_engajamento).toFixed(2),
      s.score_custom.toFixed(2),
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `desempenho-${casa}-${ano}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="text-primary" size={22} />
                Ranking de Desempenho
              </h1>
              <p className="text-xs text-muted-foreground">
                P-Score: Alinhamento + Presença + Impacto + Engajamento
              </p>
            </div>
          </div>
          <Button onClick={exportCsv} size="sm" variant="outline" className="gap-2 h-8 text-xs">
            <Download size={14} /> Exportar CSV
          </Button>
        </div>

        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-2 text-muted-foreground" size={14} />
              <Input
                placeholder="Buscar parlamentar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <Select value={casa} onValueChange={(v) => setCasa(v as "camara" | "senado")}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="camara">Câmara</SelectItem>
                <SelectItem value="senado">Senado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={partido} onValueChange={setPartido}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Partido" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos partidos</SelectItem>
                {partidos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas UFs</SelectItem>
                {ufs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <PerformanceWeightsCustomizer onChange={update} />

        <PerformanceHistogram data={filtered} highlightPartido={partido !== "all" ? partido : undefined} />

        <PerformanceCompare data={filtered} casa={casa} ano={ano} onRefreshed={reload} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy size={16} className="text-primary" />
              {filtered.length} parlamentar{filtered.length !== 1 ? "es" : ""}
              {!isDefault && (
                <Badge variant="outline" className="text-[9px] ml-2">Pesos customizados</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">
                Nenhum score calculado para este período. Abra o perfil de um deputado e clique em "Calcular agora" na aba Desempenho, ou aguarde o cron diário (03:00 UTC).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">#</TableHead>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Partido</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">UF</TableHead>
                      <TableHead className="text-xs text-right hidden md:table-cell">A</TableHead>
                      <TableHead className="text-xs text-right hidden md:table-cell">P</TableHead>
                      <TableHead className="text-xs text-right hidden md:table-cell">I</TableHead>
                      <TableHead className="text-xs text-right hidden md:table-cell">E</TableHead>
                      <TableHead className="text-xs text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s, i) => {
                      const isTop = s.score_custom >= top10Threshold;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-black text-primary text-xs">{i + 1}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            <Link
                              to={`/${casa === "camara" ? "deputado" : "senador"}/${s.parlamentar_id}`}
                              className="hover:underline"
                            >
                              {s.nome}
                            </Link>
                            {isTop && (
                              <Badge className="ml-2 text-[8px] bg-accent text-accent-foreground">Top 10%</Badge>
                            )}
                            <div className="sm:hidden text-[10px] text-muted-foreground font-normal mt-0.5">
                              {s.partido} - {s.uf}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs hidden sm:table-cell">{s.partido}</TableCell>
                          <TableCell className="text-xs hidden sm:table-cell">{s.uf}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums hidden md:table-cell">
                            {(Number(s.score_alinhamento) * 100).toFixed(0)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums hidden md:table-cell">
                            {(Number(s.score_presenca) * 100).toFixed(0)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums hidden md:table-cell">
                            {(Number(s.score_impacto) * 100).toFixed(0)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums hidden md:table-cell">
                            {(Number(s.score_engajamento) * 100).toFixed(0)}
                          </TableCell>
                          <TableCell className="text-sm text-right font-black text-primary tabular-nums">
                            {s.score_custom.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
