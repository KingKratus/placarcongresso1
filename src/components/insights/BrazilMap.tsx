import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
}

function getColor(val: number | null, classificacao?: string): string {
  if (classificacao === "Governo") return "hsl(160, 84%, 39%)";
  if (classificacao === "Oposição") return "hsl(347, 77%, 50%)";
  if (classificacao === "Centro") return "hsl(239, 84%, 67%)";
  if (val === null) return "hsl(var(--muted))";
  if (val >= 70) return "hsl(160, 84%, 39%)";
  if (val >= 36) return "hsl(239, 84%, 67%)";
  return "hsl(347, 77%, 50%)";
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

export function BrazilMap({ ufData }: Props) {
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

  // Count classifications
  const classCounts = useMemo(() => {
    const counts = { Governo: 0, Centro: 0, Oposição: 0, "Sem Dados": 0 };
    ufData.forEach((u) => {
      const val = casa === "camara" ? u.camara : u.senado;
      const cls = getClassificacao(val);
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
                const fillColor = getColor(val);
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
