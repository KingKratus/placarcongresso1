import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Users } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
} from "recharts";

interface ScoreItem {
  id: string;
  parlamentar_id: number;
  nome: string | null;
  partido: string | null;
  uf: string | null;
  score_alinhamento: number | string;
  score_presenca: number | string;
  score_impacto: number | string;
  score_engajamento: number | string;
  score_custom: number;
}

interface Props {
  data: ScoreItem[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--governo))",
  "hsl(var(--oposicao))",
];

export function PerformanceCompare({ data }: Props) {
  const [selected, setSelected] = useState<ScoreItem[]>([]);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const matches = search.trim().length >= 2
    ? data
        .filter((d) =>
          (d.nome || "").toLowerCase().includes(search.toLowerCase()) &&
          !selected.some((s) => s.id === d.id)
        )
        .slice(0, 8)
    : [];

  const add = (item: ScoreItem) => {
    if (selected.length >= 4) return;
    setSelected([...selected, item]);
    setSearch("");
    setShowPicker(false);
  };

  const remove = (id: string) => setSelected(selected.filter((s) => s.id !== id));

  const radarData = [
    { dim: "Alinhamento", ...Object.fromEntries(selected.map((s, i) => [`p${i}`, Number(s.score_alinhamento) * 100])) },
    { dim: "Presença", ...Object.fromEntries(selected.map((s, i) => [`p${i}`, Number(s.score_presenca) * 100])) },
    { dim: "Impacto", ...Object.fromEntries(selected.map((s, i) => [`p${i}`, Number(s.score_impacto) * 100])) },
    { dim: "Engajamento", ...Object.fromEntries(selected.map((s, i) => [`p${i}`, Number(s.score_engajamento) * 100])) },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users size={14} className="text-primary" />
          Comparar parlamentares (até 4)
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Visualize lado a lado as 4 dimensões do P-Score
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {selected.map((s, i) => (
            <Badge
              key={s.id}
              variant="outline"
              className="gap-1 pr-1 text-xs"
              style={{ borderColor: COLORS[i], color: COLORS[i] }}
            >
              {s.nome} ({s.partido}/{s.uf})
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-destructive/20"
                onClick={() => remove(s.id)}
              >
                <X size={10} />
              </Button>
            </Badge>
          ))}
          {selected.length < 4 && (
            <div className="relative">
              {showPicker ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    placeholder="Buscar nome..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-7 text-xs w-40"
                    onBlur={() => setTimeout(() => setShowPicker(false), 200)}
                  />
                  {matches.length > 0 && (
                    <div className="absolute top-8 left-0 z-10 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto w-64">
                      {matches.map((m) => (
                        <button
                          key={m.id}
                          className="w-full text-left px-2 py-1.5 hover:bg-accent text-xs flex justify-between"
                          onMouseDown={() => add(m)}
                        >
                          <span className="truncate">{m.nome}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {m.partido}/{m.uf} · {m.score_custom.toFixed(1)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowPicker(true)}
                >
                  <Plus size={12} /> Adicionar
                </Button>
              )}
            </div>
          )}
        </div>

        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Adicione parlamentares para comparar
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                {selected.map((s, i) => (
                  <Radar
                    key={s.id}
                    name={s.nome || ""}
                    dataKey={`p${i}`}
                    stroke={COLORS[i]}
                    fill={COLORS[i]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip contentStyle={{ fontSize: 11, padding: 6 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 font-semibold">Nome</th>
                    <th className="text-right py-1">A</th>
                    <th className="text-right py-1">P</th>
                    <th className="text-right py-1">I</th>
                    <th className="text-right py-1">E</th>
                    <th className="text-right py-1 font-black">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((s, i) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-1.5 truncate" style={{ color: COLORS[i] }}>
                        ● {s.nome}
                      </td>
                      <td className="text-right tabular-nums">{(Number(s.score_alinhamento) * 100).toFixed(0)}</td>
                      <td className="text-right tabular-nums">{(Number(s.score_presenca) * 100).toFixed(0)}</td>
                      <td className="text-right tabular-nums">{(Number(s.score_impacto) * 100).toFixed(0)}</td>
                      <td className="text-right tabular-nums">{(Number(s.score_engajamento) * 100).toFixed(0)}</td>
                      <td className="text-right tabular-nums font-black text-primary">
                        {s.score_custom.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
