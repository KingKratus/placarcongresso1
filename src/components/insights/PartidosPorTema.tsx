import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Tags, Search, Filter, TrendingUp, Download, ChevronLeft, ChevronRight, BarChart3, Grid3x3 } from "lucide-react";
import { TEMA_COLORS } from "./ThemeDistribution";

interface Props {
  ano: number;
}

interface Row {
  parlamentar_id: number;
  casa: string;
  tema: string | null;
  tipo: string;
  tipo_autoria: string | null;
}

interface PartyMeta {
  partido: string;
  uf: string;
}

const TIPOS_DISPONIVEIS = ["all", "PL", "PEC", "PLP", "PDL", "PRC", "MPV", "REQ", "Outros"];

export function PartidosPorTema({ ano }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [partyMap, setPartyMap] = useState<Record<string, PartyMeta>>({});

  // Filters
  const [temaFilter, setTemaFilter] = useState<string>("all");
  const [casaFilter, setCasaFilter] = useState<"all" | "camara" | "senado">("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [autoriaFilter, setAutoriaFilter] = useState<"all" | "autor" | "coautor">("all");
  const [search, setSearch] = useState("");
  const [topN, setTopN] = useState<string>("15");

  // New UX state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"heatmap" | "ranking">("heatmap");

  // Fetch propositions + parlamentares metadata
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Pull all propositions for the year (paginated)
      const all: Row[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("proposicoes_parlamentares")
          .select("parlamentar_id, casa, tema, tipo, tipo_autoria")
          .eq("ano", ano)
          .range(offset, offset + 999);
        if (error || !data || data.length === 0) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
        offset += 1000;
      }

      // Now fetch party data for these parlamentares
      const camIds = Array.from(new Set(all.filter((r) => r.casa === "camara").map((r) => r.parlamentar_id)));
      const senIds = Array.from(new Set(all.filter((r) => r.casa === "senado").map((r) => r.parlamentar_id)));

      const [camRes, senRes] = await Promise.all([
        camIds.length
          ? supabase
              .from("analises_deputados")
              .select("deputado_id, deputado_partido, deputado_uf")
              .eq("ano", ano)
              .in("deputado_id", camIds)
          : Promise.resolve({ data: [] as any[] }),
        senIds.length
          ? supabase
              .from("analises_senadores")
              .select("senador_id, senador_partido, senador_uf")
              .eq("ano", ano)
              .in("senador_id", senIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const map: Record<string, PartyMeta> = {};
      (camRes.data || []).forEach((d: any) => {
        map[`camara-${d.deputado_id}`] = { partido: d.deputado_partido || "S/Partido", uf: d.deputado_uf || "" };
      });
      (senRes.data || []).forEach((s: any) => {
        map[`senado-${s.senador_id}`] = { partido: s.senador_partido || "S/Partido", uf: s.senador_uf || "" };
      });

      if (cancelled) return;
      setRows(all);
      setPartyMap(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ano]);

  // Available themes & tipos in dataset
  const temasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.tema && set.add(r.tema));
    return Array.from(set).sort();
  }, [rows]);

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.tipo && set.add(r.tipo));
    return Array.from(set).sort();
  }, [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (temaFilter !== "all" && r.tema !== temaFilter) return false;
      if (casaFilter !== "all" && r.casa !== casaFilter) return false;
      if (tipoFilter !== "all" && r.tipo !== tipoFilter) return false;
      if (autoriaFilter !== "all" && (r.tipo_autoria || "autor") !== autoriaFilter) return false;
      return true;
    });
  }, [rows, temaFilter, casaFilter, tipoFilter, autoriaFilter]);

  // Aggregate by partido
  const byParty = useMemo(() => {
    const map: Record<string, { partido: string; total: number; autor: number; coautor: number; uf: Set<string> }> = {};
    filtered.forEach((r) => {
      const meta = partyMap[`${r.casa}-${r.parlamentar_id}`];
      const partido = meta?.partido || "S/Partido";
      if (!map[partido]) map[partido] = { partido, total: 0, autor: 0, coautor: 0, uf: new Set() };
      map[partido].total++;
      if ((r.tipo_autoria || "autor") === "coautor") map[partido].coautor++;
      else map[partido].autor++;
      if (meta?.uf) map[partido].uf.add(meta.uf);
    });
    let arr = Object.values(map)
      .map((v) => ({ partido: v.partido, total: v.total, autor: v.autor, coautor: v.coautor, ufs: v.uf.size }))
      .sort((a, b) => b.total - a.total);
    if (search.trim()) {
      const t = search.toLowerCase().trim();
      arr = arr.filter((p) => p.partido.toLowerCase().includes(t));
    }
    const limit = topN === "all" ? arr.length : Number(topN);
    return arr.slice(0, limit);
  }, [filtered, partyMap, search, topN]);

  // Heatmap-style: ALL parties × all themes (sorted by total)
  const heatmap = useMemo(() => {
    const partyTotals: Record<string, number> = {};
    const partyTheme: Record<string, Record<string, number>> = {};
    filtered.forEach((r) => {
      const meta = partyMap[`${r.casa}-${r.parlamentar_id}`];
      const partido = meta?.partido || "S/Partido";
      const tema = r.tema || "Outros";
      partyTotals[partido] = (partyTotals[partido] || 0) + 1;
      partyTheme[partido] = partyTheme[partido] || {};
      partyTheme[partido][tema] = (partyTheme[partido][tema] || 0) + 1;
    });
    const topParties = Object.entries(partyTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([p]) => p);
    const allTemas = Array.from(new Set(filtered.map((r) => r.tema || "Outros"))).sort();
    return { topParties, allTemas, partyTheme };
  }, [filtered, partyMap]);

  const totalProposicoes = filtered.length;
  const totalPartidos = new Set(filtered.map((r) => partyMap[`${r.casa}-${r.parlamentar_id}`]?.partido).filter(Boolean)).size;

  // Reset pagination when filters change
  useEffect(() => { setPage(0); }, [temaFilter, casaFilter, tipoFilter, autoriaFilter, search]);

  // Heatmap pagination
  const totalPages = Math.max(1, Math.ceil(heatmap.topParties.length / pageSize));
  const pagedParties = useMemo(
    () => heatmap.topParties.slice(page * pageSize, page * pageSize + pageSize),
    [heatmap.topParties, page, pageSize]
  );

  // Global heatmap max for legend scale
  const heatmapMaxValue = useMemo(() => {
    let max = 0;
    Object.values(heatmap.partyTheme).forEach((themes) => {
      Object.values(themes).forEach((v) => { if (v > max) max = v; });
    });
    return max;
  }, [heatmap.partyTheme]);

  // Selected party detail (sorted themes)
  const selectedPartyDetail = useMemo(() => {
    if (!selectedParty) return null;
    const themes = heatmap.partyTheme[selectedParty] || {};
    const arr = Object.entries(themes)
      .map(([tema, count]) => ({ tema, count }))
      .sort((a, b) => b.count - a.count);
    const total = arr.reduce((s, x) => s + x.count, 0);
    return { partido: selectedParty, total, temas: arr };
  }, [selectedParty, heatmap.partyTheme]);

  // Ranking by selected theme (across all parties)
  const themeRanking = useMemo(() => {
    if (temaFilter === "all") return [];
    const arr = heatmap.topParties.map((partido) => ({
      partido,
      total: heatmap.partyTheme[partido]?.[temaFilter] || 0,
    })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    return arr;
  }, [temaFilter, heatmap.topParties, heatmap.partyTheme]);

  // CSV export of heatmap (all parties, all themes)
  const exportHeatmapCsv = () => {
    const header = ["Partido", ...heatmap.allTemas, "Total"];
    const lines = [header.join(",")];
    heatmap.topParties.forEach((p) => {
      const themes = heatmap.partyTheme[p] || {};
      const total = Object.values(themes).reduce((s, v) => s + v, 0);
      const row = [p, ...heatmap.allTemas.map((t) => themes[t] || 0), total];
      lines.push(row.join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partidos-temas-${ano}${temaFilter !== "all" ? `-${temaFilter}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Tags size={14} className="text-primary" /> Partidos por Tema
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Quais partidos mais propõem projetos por área temática (com base em proposições autorais e de coautoria)
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-card/50 rounded-md p-2">
              <p className="text-xl font-black text-primary">{totalProposicoes}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Proposições</p>
            </div>
            <div className="text-center bg-card/50 rounded-md p-2">
              <p className="text-xl font-black text-foreground">{totalPartidos}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Partidos</p>
            </div>
            <div className="text-center bg-card/50 rounded-md p-2">
              <p className="text-xl font-black text-foreground">{temasDisponiveis.length}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Temas</p>
            </div>
          </div>

          {/* Filter row — responsive grid */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase">
              <Filter size={12} /> Filtros
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <Select value={temaFilter} onValueChange={setTemaFilter}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tema" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os temas</SelectItem>
                  {temasDisponiveis.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={casaFilter} onValueChange={(v: any) => setCasaFilter(v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ambas Casas</SelectItem>
                  <SelectItem value="camara">Câmara</SelectItem>
                  <SelectItem value="senado">Senado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {tiposDisponiveis.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={autoriaFilter} onValueChange={(v: any) => setAutoriaFilter(v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Autor + Coautor</SelectItem>
                  <SelectItem value="autor">Só Autor</SelectItem>
                  <SelectItem value="coautor">Só Coautor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={topN} onValueChange={setTopN}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Top 10 ranking</SelectItem>
                  <SelectItem value="15">Top 15 ranking</SelectItem>
                  <SelectItem value="25">Top 25 ranking</SelectItem>
                  <SelectItem value="all">Todos no ranking</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar partido..."
                  className="h-9 pl-7 text-xs"
                />
              </div>
              {(temaFilter !== "all" || casaFilter !== "all" || tipoFilter !== "all" || autoriaFilter !== "all" || search) && (
                <button
                  onClick={() => { setTemaFilter("all"); setCasaFilter("all"); setTipoFilter("all"); setAutoriaFilter("all"); setSearch(""); }}
                  className="h-9 px-3 text-[11px] font-bold text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50 transition"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Active filter badges */}
          {temaFilter !== "all" && (
            <div className="flex items-center gap-2">
              <Badge
                className="text-[10px]"
                style={{ backgroundColor: TEMA_COLORS[temaFilter] || "hsl(var(--primary))", color: "white" }}
              >
                Tema: {temaFilter}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar chart: parties by total propositions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp size={14} />
            Ranking de Partidos {temaFilter !== "all" ? `— ${temaFilter}` : "— Todos os temas"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byParty.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Nenhuma proposição encontrada para os filtros selecionados.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, byParty.length * 32)}>
              <BarChart data={byParty} layout="vertical" margin={{ left: 60, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="partido" width={55} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(value: any, name: string, props: any) => {
                    const p = props.payload;
                    return [
                      `${value} proposições (${p.autor} autor / ${p.coautor} coautor) — ${p.ufs} UFs`,
                      "Total",
                    ];
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {byParty.map((_, i) => (
                    <Cell
                      key={i}
                      fill={temaFilter !== "all" ? (TEMA_COLORS[temaFilter] || "hsl(var(--primary))") : "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Heatmap table: parties × themes */}
      {temaFilter === "all" && heatmap.topParties.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mapa de Calor — Todos os Partidos × Temas ({heatmap.topParties.length})</CardTitle>
            <p className="text-[11px] text-muted-foreground">Intensidade da cor indica volume de proposições por tema. Ordenado por total decrescente.</p>
          </CardHeader>
          <CardContent className="p-0">
           <div className="overflow-auto max-h-[600px] relative">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="sticky top-0 bg-card z-20 shadow-sm">
                  <th className="text-left p-2 font-bold text-muted-foreground sticky left-0 bg-card z-30">Partido</th>
                  {heatmap.allTemas.map((t) => (
                    <th key={t} className="p-1 font-bold text-[9px] text-muted-foreground" style={{ minWidth: 60 }}>
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: TEMA_COLORS[t] || "hsl(var(--muted))" }}
                        />
                        <span className="text-[8px] -rotate-45 origin-bottom-left whitespace-nowrap">{t}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 font-bold text-muted-foreground bg-card">Total</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.topParties.map((partido) => {
                  const themes = heatmap.partyTheme[partido] || {};
                  const total = Object.values(themes).reduce((s, v) => s + v, 0);
                  const max = Math.max(...heatmap.allTemas.map((t) => themes[t] || 0), 1);
                  return (
                    <tr key={partido} className="border-t border-border hover:bg-muted/30">
                      <td className="p-2 font-bold sticky left-0 bg-card z-10">{partido}</td>
                      {heatmap.allTemas.map((t) => {
                        const v = themes[t] || 0;
                        const intensity = v / max;
                        const color = TEMA_COLORS[t] || "hsl(var(--primary))";
                        return (
                          <td
                            key={t}
                            className="p-1 text-center font-semibold"
                            style={{
                              background: v > 0 ? `${color.replace("hsl(", "hsla(").replace(")", `, ${0.15 + intensity * 0.7})`)}` : "transparent",
                              color: intensity > 0.5 ? "white" : "hsl(var(--foreground))",
                            }}
                          >
                            {v > 0 ? v : "—"}
                          </td>
                        );
                      })}
                      <td className="p-2 font-black text-primary text-center">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
           </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
