import { useState } from "react";
import { Lightbulb, Sparkles, ThumbsUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const SUGGESTIONS = [
  { key: "heatmap_mensal", title: "Heatmap mensal", desc: "Mapa de calor: alinhamento mês × partido." },
  { key: "deteccao_viradas", title: "Detecção de viradas", desc: "Alerta automático de parlamentares com mudança >20pp entre anos." },
  { key: "voto_atipico", title: "Alerta de voto atípico", desc: "Notifica quando um parlamentar diverge do partido em 3+ votações seguidas." },
  { key: "comparador_governos", title: "Comparador histórico de governos", desc: "Score médio por mandato presidencial." },
  { key: "ranking_produtividade", title: "Ranking de produtividade", desc: "Combina proposições autorais × emendas pagas × presença." },
  { key: "alerta_emendas_publicas", title: "Painel municípios atendidos", desc: "Lista escolas/UBS beneficiadas por emendas pagas, com mapa." },
];

export function FeatureSuggestionsPanel({ context }: { context?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  const vote = async (key: string) => {
    if (voted[key]) return;
    const { error } = await supabase.from("feature_suggestions").insert({ user_id: user?.id || null, feature_key: key, context: context || null, vote: 1 } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setVoted({ ...voted, [key]: true });
    toast({ title: "Voto registrado", description: "Obrigado pela sugestão!" });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Lightbulb size={16} className="text-amber-500" /> Sugestões de novas features</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SUGGESTIONS.map((s) => (
            <div key={s.key} className="rounded-lg border border-border p-3 bg-card flex items-start gap-2">
              <Sparkles size={14} className="text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">{s.title}</p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
              <Button size="sm" variant={voted[s.key] ? "secondary" : "outline"} className="h-7 px-2 text-[10px] gap-1 shrink-0" onClick={() => vote(s.key)} disabled={voted[s.key]}>
                <ThumbsUp size={10} /> {voted[s.key] ? "Votado" : "Votar"}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Vote nas que mais te interessam — priorizamos as mais pedidas.</p>
      </CardContent>
    </Card>
  );
}