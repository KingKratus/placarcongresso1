import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";
import { EnhancedTooltip } from "./EnhancedTooltip";

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

function useToggleSeries() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = useCallback((dataKey: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  }, []);
  return { hidden, toggle };
}

function renderLegend(hidden: Set<string>, toggle: (key: string) => void) {
  return (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
        {payload?.map((entry: any) => {
          const isHidden = hidden.has(entry.dataKey);
          return (
            <button
              key={entry.dataKey}
              onClick={() => toggle(entry.dataKey)}
              className="flex items-center gap-1.5 cursor-pointer transition-opacity"
              style={{ opacity: isHidden ? 0.35 : 1 }}
            >
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.value}</span>
            </button>
          );
        })}
      </div>
    );
  };
}

export function PeriodAlignmentChart({ ano }: Props) {
  const [data, setData] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const lineToggle = useToggleSeries();
  const barToggle = useToggleSeries();

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
            <Tooltip content={<EnhancedTooltip rows={(payload, label) => {
              return payload.map((p) => {
                const casa = p.dataKey === "camara" ? "Câmara" : "Senado";
                return { label: casa, value: `${p.value}%`, color: p.stroke || p.color };
              });
            }} />} />
            <Legend content={renderLegend(lineToggle.hidden, lineToggle.toggle)} />
            {hasCamara && !lineToggle.hidden.has("camara") && (
              <Line type="monotone" dataKey="camara" name="Câmara" stroke={CAMARA_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
            )}
            {hasSenado && !lineToggle.hidden.has("senado") && (
              <Line type="monotone" dataKey="senado" name="Senado" stroke={SENADO_COLOR} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<EnhancedTooltip rows={(payload) => {
              return payload.map((p) => ({
                label: p.dataKey === "camaraVotos" ? "Votos Câmara" : "Votos Senado",
                value: Number(p.value).toLocaleString("pt-BR"),
                color: p.fill || p.color,
              }));
            }} />} />
            <Legend content={renderLegend(barToggle.hidden, barToggle.toggle)} />
            {hasCamara && !barToggle.hidden.has("camaraVotos") && <Bar dataKey="camaraVotos" name="Votos Câmara" fill={CAMARA_COLOR} radius={[4, 4, 0, 0]} opacity={0.7} />}
            {!barToggle.hidden.has("senadoVotos") && <Bar dataKey="senadoVotos" name="Votos Senado" fill={SENADO_COLOR} radius={[4, 4, 0, 0]} opacity={0.7} />}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
