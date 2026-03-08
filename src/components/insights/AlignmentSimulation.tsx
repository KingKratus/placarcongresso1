import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type AnaliseDeputado = Tables<"analises_deputados">;
type AnaliseSenador = Tables<"analises_senadores">;

interface Props {
  allYearsDeputados: AnaliseDeputado[];
  allYearsSenadores: AnaliseSenador[];
}

const CLASS_COLORS: Record<string, string> = {
  Governo: "hsl(160, 84%, 39%)",
  Oposição: "hsl(347, 77%, 50%)",
  Centro: "hsl(239, 84%, 67%)",
  "Sem Dados": "hsl(215, 16%, 47%)",
};

export function AlignmentSimulation({ allYearsDeputados, allYearsSenadores }: Props) {
  const data = useMemo(() => {
    const years = new Set<number>();
    allYearsDeputados.forEach((d) => years.add(d.ano));
    allYearsSenadores.forEach((s) => years.add(s.ano));

    return Array.from(years).sort().map((ano) => {
      const deps = allYearsDeputados.filter((d) => d.ano === ano);
      const sens = allYearsSenadores.filter((s) => s.ano === ano);
      const total = deps.length + sens.length;
      if (total === 0) return null;

      const gov = deps.filter((d) => d.classificacao === "Governo").length + sens.filter((s) => s.classificacao === "Governo").length;
      const cen = deps.filter((d) => d.classificacao === "Centro").length + sens.filter((s) => s.classificacao === "Centro").length;
      const opo = deps.filter((d) => d.classificacao === "Oposição").length + sens.filter((s) => s.classificacao === "Oposição").length;
      const sem = deps.filter((d) => d.classificacao === "Sem Dados").length + sens.filter((s) => s.classificacao === "Sem Dados").length;

      return {
        ano,
        Governo: Math.round((gov / total) * 100),
        Centro: Math.round((cen / total) * 100),
        Oposição: Math.round((opo / total) * 100),
        "Sem Dados": Math.round((sem / total) * 100),
        govCount: gov,
        cenCount: cen,
        opoCount: opo,
        semCount: sem,
        total,
      };
    }).filter(Boolean) as Array<{
      ano: number; Governo: number; Centro: number; Oposição: number; "Sem Dados": number;
      govCount: number; cenCount: number; opoCount: number; semCount: number; total: number;
    }>;
  }, [allYearsDeputados, allYearsSenadores]);

  const latest = data[data.length - 1];

  if (!latest) return null;

  const pieData = [
    { name: "Governo", value: latest.govCount },
    { name: "Centro", value: latest.cenCount },
    { name: "Oposição", value: latest.opoCount },
    { name: "Sem Dados", value: latest.semCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução da Composição (% por Ano)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
              <Bar dataKey="Governo" stackId="a" fill={CLASS_COLORS.Governo} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Centro" stackId="a" fill={CLASS_COLORS.Centro} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Oposição" stackId="a" fill={CLASS_COLORS.Oposição} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Composição Atual — {latest.ano}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={CLASS_COLORS[entry.name] || "#999"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number, name: string) => [`${v} parlamentares`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg p-2 bg-governo/10 border border-governo/20">
              <p className="text-lg font-black text-governo">{latest.Governo}%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Governo</p>
              <p className="text-xs text-foreground font-semibold">{latest.govCount}</p>
            </div>
            <div className="rounded-lg p-2 bg-centro/10 border border-centro/20">
              <p className="text-lg font-black text-centro">{latest.Centro}%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Centro</p>
              <p className="text-xs text-foreground font-semibold">{latest.cenCount}</p>
            </div>
            <div className="rounded-lg p-2 bg-oposicao/10 border border-oposicao/20">
              <p className="text-lg font-black text-oposicao">{latest.Oposição}%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Oposição</p>
              <p className="text-xs text-foreground font-semibold">{latest.opoCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
