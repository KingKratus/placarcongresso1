import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface PartyChartProps {
  analises: Analise[];
}

export function PartyChart({ analises }: PartyChartProps) {
  const filtered = analises.filter((a) => a.classificacao !== "Sem Dados");

  const partyMap: Record<string, { total: number; sum: number }> = {};
  filtered.forEach((a) => {
    const p = a.deputado_partido || "N/A";
    if (!partyMap[p]) partyMap[p] = { total: 0, sum: 0 };
    partyMap[p].total++;
    partyMap[p].sum += Number(a.score);
  });

  const data = Object.entries(partyMap)
    .map(([partido, { total, sum }]) => ({
      partido,
      media: Math.round((sum / total) * 10) / 10,
      deputados: total,
    }))
    .sort((a, b) => b.media - a.media);

  const getBarColor = (score: number) => {
    if (score >= 50) return "hsl(160, 84%, 39%)"; // governo
    if (score <= 30) return "hsl(347, 77%, 50%)"; // oposicao
    return "hsl(239, 84%, 67%)"; // centro/primary
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Alinhamento Médio por Partido</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sincronize dados para ver os gráficos
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, data.length * 28)}>
            <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="partido"
                tick={{ fontSize: 11, fontWeight: 600 }}
                width={55}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Alinhamento"]}
                labelFormatter={(label) => `Partido: ${label}`}
              />
              <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.media)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
