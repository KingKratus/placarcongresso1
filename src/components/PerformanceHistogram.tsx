import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface ScoreItem {
  partido: string | null;
  score_custom: number;
}

interface Props {
  data: ScoreItem[];
  highlightPartido?: string;
}

const BINS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function PerformanceHistogram({ data, highlightPartido }: Props) {
  const { bins, partyConcentration } = useMemo(() => {
    // Histogram bins
    const counts = new Array(BINS.length - 1).fill(0).map((_, i) => ({
      bin: `${BINS[i]}-${BINS[i + 1]}`,
      count: 0,
      partidos: {} as Record<string, number>,
    }));

    data.forEach((s) => {
      const score = s.score_custom;
      const idx = Math.min(Math.floor(score / 10), 9);
      counts[idx].count += 1;
      const p = s.partido || "S/Partido";
      counts[idx].partidos[p] = (counts[idx].partidos[p] || 0) + 1;
    });

    // Party averages — top 8
    const partyMap: Record<string, { sum: number; n: number }> = {};
    data.forEach((s) => {
      const p = s.partido || "S/Partido";
      if (!partyMap[p]) partyMap[p] = { sum: 0, n: 0 };
      partyMap[p].sum += s.score_custom;
      partyMap[p].n += 1;
    });
    const conc = Object.entries(partyMap)
      .filter(([, v]) => v.n >= 3)
      .map(([partido, v]) => ({
        partido,
        media: Math.round((v.sum / v.n) * 10) / 10,
        count: v.n,
      }))
      .sort((a, b) => b.media - a.media)
      .slice(0, 10);

    return { bins: counts, partyConcentration: conc };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Distribuição de P-Scores</CardTitle>
          <p className="text-[10px] text-muted-foreground">{data.length} parlamentares por faixa</p>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bins} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="bin" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: 6 }}
                formatter={(v: number) => [`${v} parlamentares`, "Total"]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Partidos por Média de P-Score</CardTitle>
          <p className="text-[10px] text-muted-foreground">Apenas partidos com 3+ parlamentares</p>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={partyConcentration}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="partido" tick={{ fontSize: 9 }} width={56} />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: 6 }}
                formatter={(v: number, _: string, p: any) => [`${v} (${p.payload.count} parlamentares)`, "Média"]}
              />
              <Bar dataKey="media" radius={[0, 4, 4, 0]}>
                {partyConcentration.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.partido === highlightPartido ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
