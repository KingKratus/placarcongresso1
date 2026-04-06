import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";

const CAMARA_COLOR = "hsl(239, 84%, 67%)";
const SENADO_COLOR = "hsl(160, 84%, 39%)";

const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const QUARTERS: Record<string, number[]> = {
  all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  Q1: [1, 2, 3],
  Q2: [4, 5, 6],
  Q3: [7, 8, 9],
  Q4: [10, 11, 12],
};

interface MonthlyRow {
  mes: number;
  casa: string;
  alinhados: number;
  total: number;
  score: number;
}

interface Props {
  ano: number;
}

export function PeriodAlignmentChart({ ano }: Props) {
  const [data, setData] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    setLoading(true);
    supabase.rpc("get_monthly_alignment", { p_ano: ano }).then(({ data: rows, error }) => {
      if (!error && rows) setData(rows as MonthlyRow[]);
      setLoading(false);
    });
  }, [ano]);

  const filteredMonths = QUARTERS[period] || QUARTERS.all;

  const chartData = useMemo(() => {
    const monthMap: Record<number, { camara?: number; senado?: number; camaraTotal?: number; senadoTotal?: number }> = {};
    data
      .filter((r) => filteredMonths.includes(r.mes))
      .forEach((r) => {
        monthMap[r.mes] = monthMap[r.mes] || {};
        if (r.casa === "camara") {
          monthMap[r.mes].camara = Number(r.score);
          monthMap[r.mes].camaraTotal = Number(r.total);
        } else {
          monthMap[r.mes].senado = Number(r.score);
          monthMap[r.mes].senadoTotal = Number(r.total);
        }
      });
    return Object.entries(monthMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([mes, v]) => ({
        mes: MONTH_NAMES[Number(mes)],
        camara: v.camara ?? null,
        senado: v.senado ?? null,
        camaraVotos: v.camaraTotal ?? 0,
        senadoVotos: v.senadoTotal ?? 0,
      }));
  }, [data, filteredMonths]);

  const hasCamara = chartData.some((d) => d.camara !== null);
  const hasSenado = chartData.some((d) => d.senado !== null);

  if (loading) return <Skeleton className="h-80 rounded-lg" />;
  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-muted-foreground" />
            <CardTitle className="text-base">Alinhamento Governista por Mês — {ano}</CardTitle>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano Todo</SelectItem>
              <SelectItem value="Q1">1º Tri</SelectItem>
              <SelectItem value="Q2">2º Tri</SelectItem>
              <SelectItem value="Q3">3º Tri</SelectItem>
              <SelectItem value="Q4">4º Tri</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 mt-1">
          {hasCamara && <Badge variant="outline" className="text-[10px]" style={{ borderColor: CAMARA_COLOR, color: CAMARA_COLOR }}>Câmara</Badge>}
          {hasSenado && <Badge variant="outline" className="text-[10px]" style={{ borderColor: SENADO_COLOR, color: SENADO_COLOR }}>Senado</Badge>}
          {!hasCamara && <Badge variant="secondary" className="text-[10px]">Câmara: sem orientações armazenadas para {ano}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              formatter={(v: number, name: string) => [`${v}%`, name === "camara" ? "Câmara" : "Senado"]}
              labelFormatter={(label) => `Mês: ${label}`}
            />
            <Legend formatter={(v) => (v === "camara" ? "Câmara" : "Senado")} />
            {hasCamara && (
              <Line type="monotone" dataKey="camara" name="camara" stroke={CAMARA_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
            )}
            {hasSenado && (
              <Line type="monotone" dataKey="senado" name="senado" stroke={SENADO_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, name: string) => [v.toLocaleString("pt-BR"), name === "camaraVotos" ? "Votos Câmara" : "Votos Senado"]}
            />
            <Legend formatter={(v) => (v === "camaraVotos" ? "Votos Câmara" : "Votos Senado")} />
            {hasCamara && <Bar dataKey="camaraVotos" name="camaraVotos" fill={CAMARA_COLOR} radius={[4, 4, 0, 0]} opacity={0.7} />}
            <Bar dataKey="senadoVotos" name="senadoVotos" fill={SENADO_COLOR} radius={[4, 4, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
