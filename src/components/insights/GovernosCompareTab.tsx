import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { History, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eraDe, ERA_COLORS, type Era } from "@/lib/governmentEras";

interface ThemeRow {
  tema: string;
  bolsonaro: { votacoes: number; aprovadas: number };
  lula: { votacoes: number; aprovadas: number };
}

const norm = (v: string | null | undefined) => (v || "").toLowerCase();
const isApproved = (resultado: string | null | undefined) => {
  const v = norm(resultado);
  return v.includes("aprov");
};

export function GovernosCompareTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ThemeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [temasRes, votCamRes, votSenRes] = await Promise.all([
        supabase.from("votacao_temas").select("votacao_id, casa, tema, ano").gte("ano", 2019).limit(50000),
        supabase.from("votacoes").select("id_votacao, ano, descricao").gte("ano", 2019).limit(50000),
        supabase.from("votacoes_senado").select("codigo_sessao_votacao, ano, resultado").gte("ano", 2019).limit(50000),
      ]);
      if (cancelled) return;
      const camResult = new Map<string, { ano: number; aprov: boolean }>();
      (votCamRes.data || []).forEach((v: any) => camResult.set(v.id_votacao, { ano: v.ano, aprov: isApproved(v.descricao) }));
      const senResult = new Map<string, { ano: number; aprov: boolean }>();
      (votSenRes.data || []).forEach((v: any) => senResult.set(v.codigo_sessao_votacao, { ano: v.ano, aprov: isApproved(v.resultado) }));

      const agg: Record<string, ThemeRow> = {};
      (temasRes.data || []).forEach((t: any) => {
        const lookup = t.casa === "camara" ? camResult.get(t.votacao_id) : senResult.get(t.votacao_id);
        if (!lookup) return;
        const era = eraDe(lookup.ano);
        if (era === "Outro") return;
        const r = (agg[t.tema] = agg[t.tema] || { tema: t.tema, bolsonaro: { votacoes: 0, aprovadas: 0 }, lula: { votacoes: 0, aprovadas: 0 } });
        const bucket = era === "Bolsonaro" ? r.bolsonaro : r.lula;
        bucket.votacoes += 1;
        if (lookup.aprov) bucket.aprovadas += 1;
      });

      const arr = Object.values(agg)
        .filter((r) => r.bolsonaro.votacoes + r.lula.votacoes >= 5)
        .sort((a, b) => (b.bolsonaro.votacoes + b.lula.votacoes) - (a.bolsonaro.votacoes + a.lula.votacoes));
      setRows(arr);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const chart = useMemo(() => rows.slice(0, 12).map((r) => ({
    tema: r.tema.length > 18 ? r.tema.slice(0, 17) + "…" : r.tema,
    Bolsonaro: r.bolsonaro.votacoes,
    Lula: r.lula.votacoes,
  })), [rows]);

  if (loading) return <Skeleton className="h-80 rounded-lg" />;

  if (rows.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center space-y-2">
        <History className="mx-auto text-muted-foreground" size={28} />
        <p className="text-sm font-bold">Sem dados temáticos comparáveis</p>
        <p className="text-xs text-muted-foreground">Sincronize 2019-2022 (Câmara + Senado) e rode a classificação por tema via Admin para popular este comparador.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History size={16} className="text-primary" /> Volume de votações por tema — Bolsonaro × Lula
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(280, chart.length * 30)}>
            <BarChart data={chart} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="tema" width={85} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Bolsonaro" fill={ERA_COLORS.Bolsonaro} radius={[0, 3, 3, 0]} />
              <Bar dataKey="Lula" fill={ERA_COLORS.Lula} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.slice(0, 16).map((r) => {
          const bAprovPct = r.bolsonaro.votacoes > 0 ? Math.round((r.bolsonaro.aprovadas / r.bolsonaro.votacoes) * 100) : null;
          const lAprovPct = r.lula.votacoes > 0 ? Math.round((r.lula.aprovadas / r.lula.votacoes) * 100) : null;
          const delta = (lAprovPct ?? 0) - (bAprovPct ?? 0);
          return (
            <Card key={r.tema}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{r.tema}</span>
                  {bAprovPct != null && lAprovPct != null && (
                    <Badge variant="outline" className={delta > 0 ? "text-governo" : delta < 0 ? "text-oposicao" : ""}>
                      {delta > 0 ? <TrendingUp size={10} className="inline" /> : delta < 0 ? <TrendingDown size={10} className="inline" /> : null}
                      {" "}{delta > 0 ? "+" : ""}{delta}pp aprov.
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md p-2" style={{ backgroundColor: `${ERA_COLORS.Bolsonaro}15` }}>
                  <p className="text-[9px] uppercase font-bold text-muted-foreground">Bolsonaro 19-22</p>
                  <p className="text-base font-black">{r.bolsonaro.votacoes}</p>
                  <p className="text-[10px] text-muted-foreground">votações</p>
                  <p className="text-[10px] mt-1">{r.bolsonaro.aprovadas} aprov · {bAprovPct ?? "—"}%</p>
                </div>
                <div className="rounded-md p-2" style={{ backgroundColor: `${ERA_COLORS.Lula}15` }}>
                  <p className="text-[9px] uppercase font-bold text-muted-foreground">Lula 23-26</p>
                  <p className="text-base font-black">{r.lula.votacoes}</p>
                  <p className="text-[10px] text-muted-foreground">votações</p>
                  <p className="text-[10px] mt-1">{r.lula.aprovadas} aprov · {lAprovPct ?? "—"}%</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}