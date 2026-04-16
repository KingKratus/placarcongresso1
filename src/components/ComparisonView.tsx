import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface ComparisonViewProps {
  analises: Analise[];
  onDeputyClick?: (id: number) => void;
}

interface PartyGroup {
  partido: string;
  media: number;
  deputados: Analise[];
  classificacao: string;
}

export function ComparisonView({ analises, onDeputyClick }: ComparisonViewProps) {
  const { governoPartidos, oposicaoPartidos, centroPartidos } = useMemo(() => {
    const filtered = analises.filter((a) => a.classificacao !== "Sem Dados");

    const partyMap: Record<string, { sum: number; count: number; deps: Analise[] }> = {};
    filtered.forEach((a) => {
      const p = a.deputado_partido || "N/A";
      if (!partyMap[p]) partyMap[p] = { sum: 0, count: 0, deps: [] };
      partyMap[p].sum += Number(a.score);
      partyMap[p].count++;
      partyMap[p].deps.push(a);
    });

    const parties: PartyGroup[] = Object.entries(partyMap).map(([partido, { sum, count, deps }]) => {
      const media = sum / count;
      const classificacao = media >= 50 ? "Governo" : media <= 30 ? "Oposição" : "Centro";
      return {
        partido,
        media: Math.round(media * 10) / 10,
        deputados: deps.sort((a, b) => Number(b.score) - Number(a.score)),
        classificacao,
      };
    });

    return {
      governoPartidos: parties.filter((p) => p.classificacao === "Governo").sort((a, b) => b.media - a.media),
      oposicaoPartidos: parties.filter((p) => p.classificacao === "Oposição").sort((a, b) => a.media - b.media),
      centroPartidos: parties.filter((p) => p.classificacao === "Centro").sort((a, b) => b.media - a.media),
    };
  }, [analises]);

  const totalGov = governoPartidos.reduce((s, p) => s + p.deputados.length, 0);
  const totalOpo = oposicaoPartidos.reduce((s, p) => s + p.deputados.length, 0);
  const totalCen = centroPartidos.reduce((s, p) => s + p.deputados.length, 0);

  const total = totalGov + totalOpo + totalCen;
  const donutData = [
    { name: "Governo", value: totalGov, color: "hsl(var(--governo))" },
    { name: "Centro", value: totalCen, color: "hsl(var(--centro))" },
    { name: "Oposição", value: totalOpo, color: "hsl(var(--oposicao))" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Governo" count={totalGov} parties={governoPartidos.length} className="border-governo/30 bg-governo/5" badgeClass="bg-governo text-governo-foreground" />
        <SummaryCard label="Centro" count={totalCen} parties={centroPartidos.length} className="border-centro/30 bg-centro/5" badgeClass="bg-centro text-centro-foreground" />
        <SummaryCard label="Oposição" count={totalOpo} parties={oposicaoPartidos.length} className="border-oposicao/30 bg-oposicao/5" badgeClass="bg-oposicao text-oposicao-foreground" />
      </div>

      {/* Donut chart */}
      {total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Proporção Governo × Centro × Oposição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} dep. (${((value / total) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PartyColumn
          title="Base do Governo"
          icon={<Building2 size={16} className="text-governo" />}
          parties={governoPartidos}
          accentClass="governo"
          onDeputyClick={onDeputyClick}
        />
        <PartyColumn
          title="Oposição"
          icon={<Building2 size={16} className="text-oposicao" />}
          parties={oposicaoPartidos}
          accentClass="oposicao"
          onDeputyClick={onDeputyClick}
        />
      </div>

      {/* Centro */}
      {centroPartidos.length > 0 && (
        <PartyColumn
          title="Centro / Independentes"
          icon={<Building2 size={16} className="text-centro" />}
          parties={centroPartidos}
          accentClass="centro"
          onDeputyClick={onDeputyClick}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, count, parties, className, badgeClass }: { label: string; count: number; parties: number; className: string; badgeClass: string }) {
  return (
    <Card className={`${className} border`}>
      <CardContent className="p-4 text-center">
        <Badge className={`${badgeClass} mb-2`}>{label}</Badge>
        <p className="text-2xl font-black text-foreground">{count}</p>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          deputados • {parties} partidos
        </p>
      </CardContent>
    </Card>
  );
}

function PartyColumn({ title, icon, parties, accentClass, onDeputyClick }: {
  title: string;
  icon: React.ReactNode;
  parties: PartyGroup[];
  accentClass: string;
  onDeputyClick?: (id: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {title}
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {parties.length} partidos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="px-4 pb-4 space-y-4">
            {parties.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum partido nesta categoria</p>
            )}
            {parties.map((party) => (
              <div key={party.partido} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">{party.partido}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {party.deputados.length} dep.
                    </Badge>
                  </div>
                  <span className={`text-xs font-bold text-${accentClass}`}>
                    {party.media}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {party.deputados.map((dep) => (
                    <button
                      key={dep.deputado_id}
                      onClick={() => onDeputyClick?.(dep.deputado_id)}
                      className="group flex items-center gap-1.5 bg-muted hover:bg-accent rounded-full px-2 py-0.5 transition-colors"
                      title={`${dep.deputado_nome} — ${Number(dep.score).toFixed(1)}%`}
                    >
                      {dep.deputado_foto && (
                        <img
                          src={dep.deputado_foto}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      )}
                      <span className="text-[10px] font-semibold text-foreground group-hover:text-accent-foreground truncate max-w-[100px]">
                        {dep.deputado_nome.split(" ").slice(0, 2).join(" ")}
                      </span>
                      <span className={`text-[9px] font-bold text-${accentClass}`}>
                        {Number(dep.score).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
                <Separator />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
