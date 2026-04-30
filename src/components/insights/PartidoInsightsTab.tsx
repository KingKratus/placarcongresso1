import { useEffect, useMemo, useState } from "react";
import { Users, TrendingUp, TrendingDown, AlertCircle, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getBancada } from "@/lib/bancadas";
import { useToast } from "@/hooks/use-toast";

interface Props {
  ano: number;
  deputados: any[];
  senadores: any[];
  partidos: string[];
}

export function PartidoInsightsTab({ ano, deputados, senadores, partidos }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [partido, setPartido] = useState<string>("");
  const [savedFiliacao, setSavedFiliacao] = useState<string | null>(null);
  const [loadingSave, setLoadingSave] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("partido_filiacao").eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data?.partido_filiacao) {
          setSavedFiliacao(data.partido_filiacao);
          setPartido((p) => p || data.partido_filiacao);
        }
      });
  }, [user]);

  const merged = useMemo(() => {
    const dep = deputados.filter((d) => d.deputado_partido === partido).map((d) => ({
      id: d.deputado_id, nome: d.deputado_nome, score: Number(d.score || 0),
      classificacao: d.classificacao, casa: "Câmara" as const, totalVotos: d.total_votos || 0,
    }));
    const sen = senadores.filter((s) => s.senador_partido === partido).map((s) => ({
      id: s.senador_id, nome: s.senador_nome, score: Number(s.score || 0),
      classificacao: s.classificacao, casa: "Senado" as const, totalVotos: s.total_votos || 0,
    }));
    return [...dep, ...sen].filter((p) => p.totalVotos > 0);
  }, [deputados, senadores, partido]);

  const stats = useMemo(() => {
    if (merged.length === 0) return null;
    const sorted = [...merged].sort((a, b) => b.score - a.score);
    const avg = merged.reduce((s, p) => s + p.score, 0) / merged.length;
    const stdev = Math.sqrt(merged.reduce((s, p) => s + (p.score - avg) ** 2, 0) / merged.length);
    const dissidentes = sorted.filter((p) => Math.abs(p.score - avg) > Math.max(15, stdev * 1.2)).slice(0, 5);
    const bancada = getBancada(partido);
    return { sorted, avg, stdev, dissidentes, bancada, total: merged.length };
  }, [merged, partido]);

  const saveFiliacao = async () => {
    if (!user || !partido) return;
    setLoadingSave(true);
    const { error } = await supabase.from("profiles").update({ partido_filiacao: partido } as any).eq("user_id", user.id);
    setLoadingSave(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSavedFiliacao(partido);
      toast({ title: "Partido salvo", description: `Você acompanhará ${partido}.` });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Users size={18} className="text-primary" /> Insights do meu partido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={partido} onValueChange={setPartido}>
              <SelectTrigger className="h-9 text-xs w-[200px]"><SelectValue placeholder="Escolha um partido" /></SelectTrigger>
              <SelectContent>
                {partidos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {user && partido && (
              <Button size="sm" variant={savedFiliacao === partido ? "secondary" : "default"} onClick={saveFiliacao} disabled={loadingSave} className="gap-1">
                <Star size={12} /> {savedFiliacao === partido ? "Acompanhando" : "Acompanhar"}
              </Button>
            )}
            {!user && partido && <span className="text-[10px] text-muted-foreground">Faça login para salvar.</span>}
          </div>

          {!partido && <p className="text-xs text-muted-foreground">Selecione um partido para ver suas métricas em {ano}.</p>}

          {stats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-black text-primary">{stats.total}</p><p className="text-[9px] uppercase font-bold text-muted-foreground">Parlamentares</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-black">{stats.avg.toFixed(1)}%</p><p className="text-[9px] uppercase font-bold text-muted-foreground">Alinhamento médio</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-xl font-black">{stats.stdev.toFixed(1)}pp</p><p className="text-[9px] uppercase font-bold text-muted-foreground">Coerência (desvio)</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><Badge variant="outline">{stats.bancada}</Badge><p className="text-[9px] uppercase font-bold text-muted-foreground mt-1">Bancada esperada</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle size={14} className="text-amber-500" /> Top dissidentes (mais distantes da média)</CardTitle></CardHeader>
                <CardContent>
                  {stats.dissidentes.length === 0 ? <p className="text-xs text-muted-foreground">Partido coeso — nenhum dissidente claro.</p> : (
                    <ul className="space-y-1">
                      {stats.dissidentes.map((d) => (
                        <li key={`${d.casa}-${d.id}`} className="flex items-center justify-between text-xs">
                          <span className="truncate">{d.nome} <Badge variant="outline" className="text-[9px] ml-1">{d.casa}</Badge></span>
                          <span className={d.score > stats.avg ? "text-governo font-bold" : "text-oposicao font-bold"}>
                            {d.score > stats.avg ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                            {" "}{d.score.toFixed(1)}% ({d.score > stats.avg ? "+" : ""}{(d.score - stats.avg).toFixed(1)}pp)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição do partido</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stats.sorted.slice(0, 20)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="nome" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={70} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}