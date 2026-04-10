import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Sparkles, Loader2 } from "lucide-react";
import { useVotacaoTemas, TEMAS_DISPONIVEIS } from "@/hooks/useVotacaoTemas";

export const TEMA_COLORS: Record<string, string> = {
  "Econômico": "hsl(220, 70%, 55%)",
  "Social": "hsl(280, 60%, 55%)",
  "Segurança": "hsl(347, 77%, 50%)",
  "Educação": "hsl(200, 70%, 50%)",
  "Saúde": "hsl(160, 84%, 39%)",
  "Meio Ambiente": "hsl(140, 60%, 45%)",
  "Infraestrutura": "hsl(30, 80%, 55%)",
  "Político-Institucional": "hsl(239, 84%, 67%)",
  "Trabalhista": "hsl(45, 80%, 55%)",
  "Tributário": "hsl(0, 60%, 50%)",
  "Outros": "hsl(215, 16%, 47%)",
};

interface Props {
  ano: number;
}

export function ThemeDistribution({ ano }: Props) {
  const camaraHook = useVotacaoTemas(ano, "camara");
  const senadoHook = useVotacaoTemas(ano, "senado");

  const camaraData = useMemo(() => {
    const map: Record<string, number> = {};
    camaraHook.temas.forEach((t) => { map[t.tema] = (map[t.tema] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [camaraHook.temas]);

  const senadoData = useMemo(() => {
    const map: Record<string, number> = {};
    senadoHook.temas.forEach((t) => { map[t.tema] = (map[t.tema] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [senadoHook.temas]);

  const totalCamara = camaraData.reduce((s, e) => s + e.value, 0);
  const totalSenado = senadoData.reduce((s, e) => s + e.value, 0);

  const isLoading = camaraHook.loading || senadoHook.loading;
  const isClassifying = camaraHook.classifying || senadoHook.classifying;
  const hasData = camaraData.length > 0 || senadoData.length > 0;

  const handleClassify = async () => {
    await Promise.all([camaraHook.classify(), senadoHook.classify()]);
  };

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Skeleton className="h-80" /><Skeleton className="h-80" />
    </div>;
  }

  return (
    <div className="space-y-6">
      {!hasData && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Sparkles size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              As votações de {ano} ainda não foram classificadas por tema.
            </p>
            <Button onClick={handleClassify} disabled={isClassifying} className="gap-2">
              {isClassifying ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Classificar com IA
            </Button>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Distribuição Temática — {ano}</h3>
              <p className="text-xs text-muted-foreground">{totalCamara} votações Câmara · {totalSenado} votações Senado classificadas</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClassify} disabled={isClassifying} className="gap-1 text-xs">
              {isClassifying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Reclassificar
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Temas — Câmara</CardTitle></CardHeader>
              <CardContent>
                {camaraData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados da Câmara</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={camaraData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={110}
                        label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}>
                        {camaraData.map((entry) => <Cell key={entry.name} fill={TEMA_COLORS[entry.name] || "#999"} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} votações`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Temas — Senado</CardTitle></CardHeader>
              <CardContent>
                {senadoData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados do Senado</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={senadoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={110}
                        label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}>
                        {senadoData.map((entry) => <Cell key={entry.name} fill={TEMA_COLORS[entry.name] || "#999"} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} votações`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Theme legend with counts */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {Object.entries(TEMA_COLORS).map(([tema, color]) => {
                  const cam = camaraData.find(d => d.name === tema)?.value || 0;
                  const sen = senadoData.find(d => d.name === tema)?.value || 0;
                  if (cam === 0 && sen === 0) return null;
                  return (
                    <Badge key={tema} variant="outline" className="text-xs gap-1.5 py-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                      {tema}: {cam + sen}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
