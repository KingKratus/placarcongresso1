import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type AnaliseDeputado = Tables<"analises_deputados">;
type AnaliseSenador = Tables<"analises_senadores">;

interface Props {
  allYearsDeputados: AnaliseDeputado[];
  allYearsSenadores: AnaliseSenador[];
}

const CAMARA_COLOR = "hsl(239, 84%, 67%)";
const SENADO_COLOR = "hsl(160, 84%, 39%)";

export function AlignmentTrendChart({ allYearsDeputados, allYearsSenadores }: Props) {
  const trendData = useMemo(() => {
    const yearsMap: Record<number, { camaraSum: number; camaraCount: number; senadoSum: number; senadoCount: number; govCam: number; cenCam: number; opoCam: number; govSen: number; cenSen: number; opoSen: number }> = {};

    allYearsDeputados.forEach((d) => {
      if (!yearsMap[d.ano]) yearsMap[d.ano] = { camaraSum: 0, camaraCount: 0, senadoSum: 0, senadoCount: 0, govCam: 0, cenCam: 0, opoCam: 0, govSen: 0, cenSen: 0, opoSen: 0 };
      yearsMap[d.ano].camaraSum += Number(d.score);
      yearsMap[d.ano].camaraCount++;
      if (d.classificacao === "Governo") yearsMap[d.ano].govCam++;
      else if (d.classificacao === "Centro") yearsMap[d.ano].cenCam++;
      else if (d.classificacao === "Oposição") yearsMap[d.ano].opoCam++;
    });

    allYearsSenadores.forEach((s) => {
      if (!yearsMap[s.ano]) yearsMap[s.ano] = { camaraSum: 0, camaraCount: 0, senadoSum: 0, senadoCount: 0, govCam: 0, cenCam: 0, opoCam: 0, govSen: 0, cenSen: 0, opoSen: 0 };
      yearsMap[s.ano].senadoSum += Number(s.score);
      yearsMap[s.ano].senadoCount++;
      if (s.classificacao === "Governo") yearsMap[s.ano].govSen++;
      else if (s.classificacao === "Centro") yearsMap[s.ano].cenSen++;
      else if (s.classificacao === "Oposição") yearsMap[s.ano].opoSen++;
    });

    return Object.entries(yearsMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, v]) => ({
        ano: Number(year),
        camara: v.camaraCount ? Math.round(v.camaraSum / v.camaraCount) : 0,
        senado: v.senadoCount ? Math.round(v.senadoSum / v.senadoCount) : 0,
      }));
  }, [allYearsDeputados, allYearsSenadores]);

  if (trendData.length < 2) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tendência de Alinhamento Médio por Ano</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Legend />
            <Line type="monotone" dataKey="camara" name="Câmara" stroke={CAMARA_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
            <Line type="monotone" dataKey="senado" name="Senado" stroke={SENADO_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
