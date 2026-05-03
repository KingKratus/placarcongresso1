import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ParlamentarContact } from "@/components/ParlamentarContact";

const STATE_TO_UF: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
  "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
  "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO",
  "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sergipe": "SE", "Tocantins": "TO",
};

interface UfDataItem {
  uf: string;
  camara: number | null;
  senado: number | null;
  camaraClass: string;
  senadoClass: string;
}

interface Props {
  ufData: UfDataItem[];
  deputados?: any[];
  senadores?: any[];
}

const PALETTE: Record<string, string> = {
  Governo: "hsl(160, 84%, 39%)",
  Centro: "hsl(239, 84%, 67%)",
  Oposição: "hsl(347, 77%, 50%)",
  "Sem Dados": "hsl(var(--muted))",
};

function getColor(val: number | null, classificacao?: string): string {
  if (classificacao && PALETTE[classificacao]) return PALETTE[classificacao];
  if (val === null) return PALETTE["Sem Dados"];
  if (val >= 70) return PALETTE.Governo;
  if (val >= 36) return PALETTE.Centro;
  return PALETTE.Oposição;
}

function getClassificacao(val: number | null): string {
  if (val === null) return "Sem Dados";
  if (val >= 70) return "Governo";
  if (val >= 36) return "Centro";
  return "Oposição";
}

// Simple Mercator projection for Brazil bounds
const MIN_LNG = -74, MAX_LNG = -34, MIN_LAT = -34, MAX_LAT = 6;
const SVG_W = 800, SVG_H = 900;

function project(lng: number, lat: number): [number, number] {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * SVG_W;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * SVG_H;
  return [x, y];
}

function coordsToPath(coords: number[][]): string {
  return coords
    .map((c, i) => {
      const [x, y] = project(c[0], c[1]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

function featureToPath(geometry: any): string {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring: number[][]) => coordsToPath(ring)).join(" ");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon: number[][][]) =>
        polygon.map((ring: number[][]) => coordsToPath(ring)).join(" ")
      )
      .join(" ");
  }
  return "";
}

interface GeoFeature {
  properties: { name?: string; sigla?: string; [key: string]: any };
  geometry: any;
}

export function BrazilMap({ ufData, deputados = [], senadores = [] }: Props) {
  const [geojson, setGeojson] = useState<GeoFeature[] | null>(null);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [hoveredUf, setHoveredUf] = useState<string | null>(null);
  const [casa, setCasa] = useState<"camara" | "senado">("camara");

  useEffect(() => {
    fetch("/brazil-states.geojson")
      .then((r) => r.json())
      .then((data) => setGeojson(data.features || []))
      .catch(console.error);
  }, []);

  const ufMap = useMemo(() => {
    const map: Record<string, UfDataItem> = {};
    ufData.forEach((u) => { map[u.uf] = u; });
    return map;
  }, [ufData]);

  const getUfFromFeature = useCallback((f: GeoFeature): string => {
    if (f.properties.sigla) return f.properties.sigla;
    if (f.properties.name) return STATE_TO_UF[f.properties.name] || f.properties.name;
    return "";
  }, []);

  const selectedData = selectedUf ? ufMap[selectedUf] : null;
  const activeUf = selectedUf || hoveredUf;

  const stateParlamentares = useMemo(() => {
    if (!activeUf) return [];
    const deps = deputados.filter((d) => d.deputado_uf === activeUf).map((d) => ({ id: d.deputado_id, nome: d.deputado_nome, partido: d.deputado_partido, uf: d.deputado_uf, foto: d.deputado_foto, score: Number(d.score), classificacao: d.classificacao, votos: d.total_votos, casa: "camara" as const, labelCasa: "Câmara" }));
    const sens = senadores.filter((s) => s.senador_uf === activeUf).map((s) => ({ id: s.senador_id, nome: s.senador_nome, partido: s.senador_partido, uf: s.senador_uf, foto: s.senador_foto, score: Number(s.score), classificacao: s.classificacao, votos: s.total_votos, casa: "senado" as const, labelCasa: "Senado" }));
    const all = casa === "camara" ? deps : casa === "senado" ? sens : [...deps, ...sens];
    return all.sort((a, b) => b.score - a.score);
  }, [activeUf, deputados, senadores, casa]);

  const stateCharts = useMemo(() => {
    const classMap: Record<string, number> = {};
    const partyMap: Record<string, { sum: number; count: number }> = {};
    stateParlamentares.forEach((p) => {
      classMap[p.classificacao || "Sem Dados"] = (classMap[p.classificacao || "Sem Dados"] || 0) + 1;
      const party = p.partido || "Sem partido";
      partyMap[party] = partyMap[party] || { sum: 0, count: 0 };
      partyMap[party].sum += p.score; partyMap[party].count += 1;
    });
    return {
      classData: Object.entries(classMap).map(([name, value]) => ({ name, value })),
      partyData: Object.entries(partyMap).map(([partido, v]) => ({ partido, score: Math.round(v.sum / v.count), count: v.count })).sort((a, b) => b.score - a.score).slice(0, 8),
    };
  }, [stateParlamentares]);

  // Count classifications
  const classCounts = useMemo(() => {
    const counts = { Governo: 0, Centro: 0, Oposição: 0, "Sem Dados": 0 };
    ufData.forEach((u) => {
      const cls = casa === "camara" ? u.camaraClass : u.senadoClass;
      counts[cls as keyof typeof counts]++;
    });
    return counts;
  }, [ufData, casa]);

  if (!geojson) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando mapa...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={casa} onValueChange={(v) => setCasa(v as "camara" | "senado")}>
        <TabsList>
          <TabsTrigger value="camara">Câmara</TabsTrigger>
          <TabsTrigger value="senado">Senado</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(160, 84%, 39%)" }} />
          <span className="text-xs font-semibold">Governo ({classCounts.Governo})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(239, 84%, 67%)" }} />
          <span className="text-xs font-semibold">Centro ({classCounts.Centro})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(347, 77%, 50%)" }} />
          <span className="text-xs font-semibold">Oposição ({classCounts.Oposição})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <span className="text-xs font-semibold">Sem Dados ({classCounts["Sem Dados"]})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="md:col-span-2">
          <CardContent className="p-2">
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" style={{ maxHeight: 600 }}>
              {geojson.map((feature, i) => {
                const uf = getUfFromFeature(feature);
                const data = ufMap[uf];
                const val = data ? (casa === "camara" ? data.camara : data.senado) : null;
                const cls = data ? (casa === "camara" ? data.camaraClass : data.senadoClass) : undefined;
                const fillColor = getColor(val, cls);
                const isHovered = hoveredUf === uf;
                const isSelected = selectedUf === uf;
                const path = featureToPath(feature.geometry);

                return (
                  <path
                    key={`${uf}-${i}`}
                    d={path}
                    fill={fillColor}
                    stroke="hsl(var(--background))"
                    strokeWidth={isSelected ? 3 : 1.5}
                    opacity={isHovered ? 0.85 : 1}
                    className="cursor-pointer transition-opacity"
                    onClick={() => setSelectedUf(uf === selectedUf ? null : uf)}
                    onMouseEnter={() => setHoveredUf(uf)}
                    onMouseLeave={() => setHoveredUf(null)}
                  />
                );
              })}
              {/* State labels */}
              {geojson.map((feature, i) => {
                const uf = getUfFromFeature(feature);
                const geometry = feature.geometry;
                // Compute rough centroid
                let coords: number[][] = [];
                if (geometry.type === "Polygon") coords = geometry.coordinates[0];
                else if (geometry.type === "MultiPolygon") coords = geometry.coordinates[0][0];

                if (coords.length === 0) return null;
                const avgLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
                const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
                const [cx, cy] = project(avgLng, avgLat);

                return (
                  <text
                    key={`label-${uf}-${i}`}
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="800"
                    fill="white"
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth="0.5"
                    className="pointer-events-none select-none"
                  >
                    {uf}
                  </text>
                );
              })}
            </svg>
          </CardContent>
        </Card>

        {/* Details panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {selectedData ? `Estado: ${selectedUf}` : hoveredUf ? `Estado: ${hoveredUf}` : "Selecione um estado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(selectedData || (hoveredUf && ufMap[hoveredUf])) ? (() => {
              const d = selectedData || ufMap[hoveredUf!];
              const uf = selectedUf || hoveredUf;
              return (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Câmara</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" style={{
                          backgroundColor: getColor(d.camara),
                          color: "#fff", border: "none"
                        }}>
                          {getClassificacao(d.camara)}
                        </Badge>
                        <span className="text-sm font-black">{d.camara !== null ? `${d.camara}%` : "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Senado</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" style={{
                          backgroundColor: getColor(d.senado),
                          color: "#fff", border: "none"
                        }}>
                          {getClassificacao(d.senado)}
                        </Badge>
                        <span className="text-sm font-black">{d.senado !== null ? `${d.senado}%` : "—"}</span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })() : (
              <p className="text-xs text-muted-foreground">
                Clique em um estado no mapa para ver detalhes de alinhamento.
              </p>
            )}

            {/* All states summary */}
            <div className="border-t border-border pt-3 mt-3">
              <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Todos os Estados</h4>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {ufData
                  .sort((a, b) => {
                    const valA = casa === "camara" ? a.camara : a.senado;
                    const valB = casa === "camara" ? b.camara : b.senado;
                    return (valB ?? -1) - (valA ?? -1);
                  })
                  .map((u) => {
                    const val = casa === "camara" ? u.camara : u.senado;
                    return (
                      <div
                        key={u.uf}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                          selectedUf === u.uf ? "bg-accent" : "hover:bg-accent/50"
                        }`}
                        onClick={() => setSelectedUf(u.uf === selectedUf ? null : u.uf)}
                      >
                        <span className="text-xs font-bold">{u.uf}</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getColor(val) }}
                          />
                          <span className="text-xs font-semibold">{val !== null ? `${val}%` : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {activeUf && stateParlamentares.length > 0 && (
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground">Parlamentares de {activeUf}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border p-2 text-center"><p className="text-lg font-black">{stateParlamentares.length}</p><p className="text-[9px] text-muted-foreground font-bold uppercase">Parlamentares</p></div>
                  <div className="rounded-md border border-border p-2 text-center"><p className="text-lg font-black">{Math.round(stateParlamentares.reduce((s, p) => s + p.score, 0) / stateParlamentares.length)}%</p><p className="text-[9px] text-muted-foreground font-bold uppercase">Score médio</p></div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stateCharts.classData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Qtd" radius={[4, 4, 0, 0]}>{stateCharts.classData.map((d) => <Cell key={d.name} fill={getColor(null, d.name)} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
                {stateCharts.partyData.length > 0 && <ResponsiveContainer width="100%" height={170}><BarChart data={stateCharts.partyData} layout="vertical" margin={{ left: 35 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="partido" width={34} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="score" name="Score médio" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>}
                <div className="space-y-2 max-h-[460px] overflow-auto pr-1">
                  {stateParlamentares.map((p) => (
                    <div key={`${p.casa}-${p.id}`} className="rounded-md border border-border p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {p.foto && <img src={p.foto} alt={p.nome} className="h-9 w-9 rounded object-cover" />}
                        <div className="min-w-0 flex-1">
                          <Link to={`/${p.casa === "camara" ? "deputado" : "senador"}/${p.id}`} className="text-xs font-black hover:text-primary truncate block">{p.nome}</Link>
                          <p className="text-[10px] text-muted-foreground">{p.partido || "—"} · {p.labelCasa} · {p.votos || 0} votos</p>
                        </div>
                        <Badge style={{ backgroundColor: getColor(p.score), color: "#fff", border: "none" }} className="text-[9px] shrink-0">{Math.round(p.score)}%</Badge>
                      </div>
                      <ParlamentarContact parlamentarId={p.id} casa={p.casa} compact />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
