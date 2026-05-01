import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, TrendingUp, TrendingDown, Minus, Trophy, Vote, Flag, Brain, Scale, Info, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
import { ReportEmailButton } from "@/components/ReportEmailButton";
import { getBancada } from "@/lib/bancadas";
import { ParlamentarBadgesTema } from "@/components/ParlamentarBadgesTema";
import { supabase } from "@/integrations/supabase/client";

const CAMARA_COLOR = "hsl(239, 84%, 67%)";
const SENADO_COLOR = "hsl(160, 84%, 39%)";
const DIFF_COLOR = "hsl(45, 80%, 55%)";

type Dep = {
  deputado_id: number;
  deputado_nome: string;
  deputado_partido: string | null;
  deputado_uf: string | null;
  deputado_foto: string | null;
  ano: number;
  score: number;
  classificacao: string;
  total_votos: number;
  votos_alinhados: number;
};

type Sen = {
  senador_id: number;
  senador_nome: string;
  senador_partido: string | null;
  senador_uf: string | null;
  senador_foto: string | null;
  ano: number;
  score: number;
  classificacao: string;
  total_votos: number;
  votos_alinhados: number;
};

type Parlamentar = {
  key: string;
  id: number;
  casa: "Câmara" | "Senado";
  nome: string;
  partido: string | null;
  uf: string | null;
  foto: string | null;
  ano: number;
  score: number;
  classificacao: string;
  totalVotos: number;
  votosAlinhados: number;
};

interface Props {
  deputados: Dep[];
  senadores: Sen[];
  allYearsDeputados: Dep[];
  allYearsSenadores: Sen[];
  ano: number;
}

function normalizeDeputado(d: Dep): Parlamentar {
  return {
    key: `camara-${d.deputado_id}`,
    id: d.deputado_id,
    casa: "Câmara",
    nome: d.deputado_nome,
    partido: d.deputado_partido,
    uf: d.deputado_uf,
    foto: d.deputado_foto,
    ano: d.ano,
    score: Number(d.score || 0),
    classificacao: d.classificacao,
    totalVotos: d.total_votos || 0,
    votosAlinhados: d.votos_alinhados || 0,
  };
}

function normalizeSenador(s: Sen): Parlamentar {
  return {
    key: `senado-${s.senador_id}`,
    id: s.senador_id,
    casa: "Senado",
    nome: s.senador_nome,
    partido: s.senador_partido,
    uf: s.senador_uf,
    foto: s.senador_foto,
    ano: s.ano,
    score: Number(s.score || 0),
    classificacao: s.classificacao,
    totalVotos: s.total_votos || 0,
    votosAlinhados: s.votos_alinhados || 0,
  };
}

function deltaIcon(delta: number) {
  if (delta > 0.5) return <TrendingUp size={14} className="text-governo" />;
  if (delta < -0.5) return <TrendingDown size={14} className="text-oposicao" />;
  return <Minus size={14} className="text-muted-foreground" />;
}

function rankOf(list: Parlamentar[], p?: Parlamentar | null) {
  if (!p) return null;
  const sorted = [...list].filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const idx = sorted.findIndex((x) => x.key === p.key);
  return idx >= 0 ? idx + 1 : null;
}

function expectedRange(bancada: string): [number, number] {
  if (bancada === "Base Gov") return [70, 100];
  if (bancada === "Oposição") return [0, 35];
  return [35, 70];
}

function alignmentLabel(score: number, bancada: string) {
  const [lo, hi] = expectedRange(bancada);
  if (score >= lo && score <= hi) return { text: "Alinhado ao perfil esperado", tone: "governo" as const };
  if (score > hi) return { text: bancada === "Oposição" ? "Mais governista que o partido" : "Acima do esperado", tone: "primary" as const };
  return { text: bancada === "Base Gov" ? "Dissidente do governo" : "Abaixo do esperado", tone: "oposicao" as const };
}

function PartyAlignmentCard({ p, partyAvg }: { p: Parlamentar; partyAvg: number | null }) {
  const bancada = getBancada(p.partido || "");
  const [lo, hi] = expectedRange(bancada);
  const lbl = alignmentLabel(p.score, bancada);
  const desvio = partyAvg !== null ? p.score - partyAvg : null;
  const toneClass = lbl.tone === "governo" ? "text-governo" : lbl.tone === "oposicao" ? "text-oposicao" : "text-primary";
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
          <Flag size={10} /> Bancada esperada
        </span>
        <Badge variant="outline" className="text-[9px]">{bancada}</Badge>
      </div>
      <p className={`text-xs font-bold ${toneClass}`}>{lbl.text}</p>
      <div className="text-[10px] text-muted-foreground">
        Faixa esperada: <b>{lo}–{hi}%</b> · Score real: <b>{p.score.toFixed(1)}%</b>
      </div>
      {desvio !== null && (
        <div className="text-[10px] text-muted-foreground">
          Média do partido ({p.partido}): <b>{partyAvg!.toFixed(1)}%</b> ·
          Desvio: <b className={desvio >= 0 ? "text-governo" : "text-oposicao"}>{desvio >= 0 ? "+" : ""}{desvio.toFixed(1)}pp</b>
        </div>
      )}
    </div>
  );
}

function MiniProfile({ p, rank, houseRank }: { p?: Parlamentar | null; rank: number | null; houseRank: number | null }) {
  if (!p) return <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Selecione um parlamentar.</div>;
  return (
    <div className="rounded-lg border border-border p-3 space-y-3 bg-card">
      <div className="flex items-center gap-3 min-w-0">
        {p.foto ? <img src={p.foto} alt={p.nome} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-muted" />}
        <div className="min-w-0">
          <p className="font-black text-sm truncate">{p.nome}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="secondary" className="text-[10px]">{p.casa}</Badge>
            <Badge variant="outline" className="text-[10px]">{p.partido || "—"}/{p.uf || "—"}</Badge>
            <Badge className="text-[10px] border-0">{p.classificacao}</Badge>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-2xl font-black text-primary">{p.score.toFixed(1)}%</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Score</p></div>
        <div><p className="text-2xl font-black">#{rank || "—"}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Geral</p></div>
        <div><p className="text-2xl font-black">#{houseRank || "—"}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Casa</p></div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Vote size={12} /> {p.totalVotos} votos</span>
        <span>{p.votosAlinhados} alinhados</span>
      </div>
      <ParlamentarBadgesTema parlamentarId={p.id} casa={p.casa === "Câmara" ? "camara" : "senado"} ano={p.ano} max={3} />
    </div>
  );
}

export function ComparacaoParlamentaresTab({ deputados, senadores, allYearsDeputados, allYearsSenadores, ano }: Props) {
  const current = useMemo(() => [
    ...deputados.map(normalizeDeputado),
    ...senadores.map(normalizeSenador),
  ].sort((a, b) => a.nome.localeCompare(b.nome)), [deputados, senadores]);

  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [weightMode, setWeightMode] = useState<"tradicional" | "ia">("tradicional");
  const [iaScores, setIaScores] = useState<Record<string, number>>({});

  // Carrega scores IA das análises ponderadas
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("analises_ponderadas")
        .select("parlamentar_id, casa, ano, score_ia")
        .eq("ano", ano)
        .limit(2000);
      if (cancelled) return;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const casa = r.casa === "camara" ? "camara" : "senado";
        map[`${casa}-${r.parlamentar_id}`] = Number(r.score_ia) || 0;
      });
      setIaScores(map);
    })();
    return () => { cancelled = true; };
  }, [ano]);

  const effectiveScore = (p: Parlamentar) => {
    if (weightMode === "ia") {
      const k = `${p.casa === "Câmara" ? "camara" : "senado"}-${p.id}`;
      const ia = iaScores[k];
      if (ia && ia > 0) return ia;
    }
    return p.score;
  };

  const selectedA = current.find((p) => p.key === leftKey) || current[0] || null;
  const selectedB = current.find((p) => p.key === rightKey) || current.find((p) => p.key !== selectedA?.key) || null;

  const allCurrentRank = useMemo(() => [...current].sort((a, b) => b.score - a.score), [current]);
  const camaraRank = useMemo(() => current.filter((p) => p.casa === "Câmara").sort((a, b) => b.score - a.score), [current]);
  const senadoRank = useMemo(() => current.filter((p) => p.casa === "Senado").sort((a, b) => b.score - a.score), [current]);

  const yearly = useMemo(() => {
    const depYears = allYearsDeputados.map(normalizeDeputado);
    const senYears = allYearsSenadores.map(normalizeSenador);
    const years = Array.from(new Set([...depYears, ...senYears].map((p) => p.ano))).sort();
    return years.map((y) => {
      const a = [...depYears, ...senYears].find((p) => p.key === selectedA?.key && p.ano === y);
      const b = [...depYears, ...senYears].find((p) => p.key === selectedB?.key && p.ano === y);
      return {
        ano: y,
        parlamentarA: a?.score ?? null,
        parlamentarB: b?.score ?? null,
        diferenca: a && b ? Math.abs(a.score - b.score) : null,
      };
    });
  }, [allYearsDeputados, allYearsSenadores, selectedA?.key, selectedB?.key]);

  const firstA = yearly.find((d) => d.parlamentarA !== null)?.parlamentarA ?? selectedA?.score ?? 0;
  const lastA = [...yearly].reverse().find((d) => d.parlamentarA !== null)?.parlamentarA ?? selectedA?.score ?? 0;
  const firstB = yearly.find((d) => d.parlamentarB !== null)?.parlamentarB ?? selectedB?.score ?? 0;
  const lastB = [...yearly].reverse().find((d) => d.parlamentarB !== null)?.parlamentarB ?? selectedB?.score ?? 0;
  const deltaA = Number(lastA) - Number(firstA);
  const deltaB = Number(lastB) - Number(firstB);
  const spread = selectedA && selectedB ? Math.abs(selectedA.score - selectedB.score) : 0;

  const houseList = (p?: Parlamentar | null) => p?.casa === "Câmara" ? camaraRank : senadoRank;

  const partyAverages = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const p of current) {
      if (!p.partido || p.score <= 0) continue;
      const k = `${p.casa}|${p.partido}`;
      const e = map.get(k) || { sum: 0, n: 0 };
      e.sum += p.score; e.n += 1; map.set(k, e);
    }
    return map;
  }, [current]);
  const avgFor = (p?: Parlamentar | null) => {
    if (!p?.partido) return null;
    const e = partyAverages.get(`${p.casa}|${p.partido}`);
    return e && e.n > 0 ? e.sum / e.n : null;
  };

  const report = selectedA && selectedB ? {
    title: `Comparação ${selectedA.nome} x ${selectedB.nome}`,
    summary: `${selectedA.nome} (${selectedA.score.toFixed(1)}%) e ${selectedB.nome} (${selectedB.score.toFixed(1)}%) têm diferença de ${spread.toFixed(1)} pontos em ${ano}.`,
    sections: [
      `Ranking geral: ${selectedA.nome} #${rankOf(allCurrentRank, selectedA) || "—"}; ${selectedB.nome} #${rankOf(allCurrentRank, selectedB) || "—"}.`,
      `Evolução: ${selectedA.nome} ${deltaA >= 0 ? "+" : ""}${deltaA.toFixed(1)}pp; ${selectedB.nome} ${deltaB >= 0 ? "+" : ""}${deltaB.toFixed(1)}pp.`,
    ],
  } : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2"><GitCompareArrows size={18} className="text-primary" /> Comparar parlamentares</CardTitle>
            {report && <ReportEmailButton report={report} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={selectedA?.key || leftKey} onValueChange={setLeftKey}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Primeiro parlamentar" /></SelectTrigger>
              <SelectContent>
                {current.map((p) => <SelectItem key={p.key} value={p.key}>{p.nome} — {p.casa}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedB?.key || rightKey} onValueChange={setRightKey}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Segundo parlamentar" /></SelectTrigger>
              <SelectContent>
                {current.map((p) => <SelectItem key={p.key} value={p.key}>{p.nome} — {p.casa}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MiniProfile p={selectedA} rank={rankOf(allCurrentRank, selectedA)} houseRank={rankOf(houseList(selectedA), selectedA)} />
            <MiniProfile p={selectedB} rank={rankOf(allCurrentRank, selectedB)} houseRank={rankOf(houseList(selectedB), selectedB)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {selectedA && <PartyAlignmentCard p={selectedA} partyAvg={avgFor(selectedA)} />}
            {selectedB && <PartyAlignmentCard p={selectedB} partyAvg={avgFor(selectedB)} />}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-[10px] uppercase font-bold text-muted-foreground">Diferença atual</p><p className="text-2xl font-black text-primary">{spread.toFixed(1)}pp</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[10px] uppercase font-bold text-muted-foreground">Evolução A</p><p className="text-2xl font-black flex items-center gap-1">{deltaIcon(deltaA)}{deltaA >= 0 ? "+" : ""}{deltaA.toFixed(1)}pp</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[10px] uppercase font-bold text-muted-foreground">Evolução B</p><p className="text-2xl font-black flex items-center gap-1">{deltaIcon(deltaB)}{deltaB >= 0 ? "+" : ""}{deltaB.toFixed(1)}pp</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp size={16} /> Evolução lado a lado</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={yearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="parlamentarA" name={selectedA?.nome || "A"} stroke={selectedA?.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR} strokeWidth={3} connectNulls />
              <Line type="monotone" dataKey="parlamentarB" name={selectedB?.nome || "B"} stroke={selectedB?.casa === "Câmara" ? CAMARA_COLOR : SENADO_COLOR} strokeWidth={3} strokeDasharray="5 4" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy size={16} /> Comparação direta</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[
              { metrica: "Score", A: selectedA?.score || 0, B: selectedB?.score || 0 },
              { metrica: "Votos", A: selectedA?.totalVotos || 0, B: selectedB?.totalVotos || 0 },
              { metrica: "Alinhados", A: selectedA?.votosAlinhados || 0, B: selectedB?.votosAlinhados || 0 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="metrica" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="A" name={selectedA?.nome || "A"} fill={CAMARA_COLOR} radius={[4, 4, 0, 0]} />
              <Bar dataKey="B" name={selectedB?.nome || "B"} fill={DIFF_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
