import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Compass, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  parlamentar_id: number;
  casa: "camara" | "senado";
  ano: number;
  nome: string;
}

interface NolanData {
  economic_axis: number;
  social_axis: number;
  rationale: string;
  source?: string;
}

function quadrantLabel(eco: number, soc: number): string {
  if (eco >= 0 && soc >= 0) return "Conservador";
  if (eco >= 0 && soc < 0) return "Libertário";
  if (eco < 0 && soc >= 0) return "Estatista";
  return "Progressista";
}

export function NolanDiagram({ parlamentar_id, casa, ano, nome }: Props) {
  const [data, setData] = useState<NolanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: row } = await supabase
      .from("nolan_diagrams")
      .select("*")
      .eq("parlamentar_id", parlamentar_id).eq("casa", casa).eq("ano", ano)
      .maybeSingle();
    if (row) setData(row as NolanData);
    setLoading(false);
  };

  useEffect(() => { load(); }, [parlamentar_id, casa, ano]);

  const generate = async (force = false) => {
    setGenerating(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nolan-diagram`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ parlamentar_id, casa, ano, force }),
        }
      );
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
      setData(j);
      toast.success(`Diagrama gerado (${j.source})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error("Erro: " + msg);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin" size={20} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Compass size={14} className="text-primary" /> Diagrama de Nolan (IA)
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1"
            onClick={() => generate(true)}
            disabled={generating}
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {data ? "Regenerar" : "Gerar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Clique em "Gerar" para a IA posicionar {nome} no diagrama de Nolan baseado em suas proposições e votações.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Diagram (rotated square = diamond) */}
            <div className="relative mx-auto w-64 h-64">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-border" />
              {/* Quadrants - diamond rotated */}
              <svg viewBox="-1.1 -1.1 2.2 2.2" className="absolute inset-0 w-full h-full">
                {/* Diamond outline */}
                <polygon
                  points="0,-1 1,0 0,1 -1,0"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.02"
                />
                {/* Cross axes */}
                <line x1="-1" y1="0" x2="1" y2="0" stroke="hsl(var(--border))" strokeWidth="0.005" strokeDasharray="0.04" />
                <line x1="0" y1="-1" x2="0" y2="1" stroke="hsl(var(--border))" strokeWidth="0.005" strokeDasharray="0.04" />
                {/* Quadrant fills */}
                <polygon points="0,-1 1,0 0,0" fill="hsl(var(--governo) / 0.08)" />
                <polygon points="1,0 0,1 0,0" fill="hsl(var(--accent) / 0.08)" />
                <polygon points="0,1 -1,0 0,0" fill="hsl(var(--oposicao) / 0.08)" />
                <polygon points="-1,0 0,-1 0,0" fill="hsl(var(--centro) / 0.08)" />
                {/* Position dot */}
                <circle
                  cx={data.economic_axis}
                  cy={-data.social_axis}
                  r="0.06"
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--card))"
                  strokeWidth="0.02"
                />
              </svg>
              {/* Quadrant labels */}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-muted-foreground">Libertário</span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-muted-foreground">Autoritário</span>
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-muted-foreground writing-vertical">Esquerda</span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-muted-foreground">Direita</span>
            </div>

            <div className="text-center">
              <p className="text-sm font-black text-primary uppercase tracking-wider">
                {quadrantLabel(data.economic_axis, data.social_axis)}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                Econômico: {data.economic_axis.toFixed(2)} · Social: {data.social_axis.toFixed(2)}
              </p>
            </div>

            {data.rationale && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 italic">
                {data.rationale}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
