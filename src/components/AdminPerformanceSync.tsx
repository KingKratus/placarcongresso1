import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  ano: number;
}

export function AdminPerformanceSync({ ano }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-performance", { body });
      if (error) throw error;
      toast({
        title: "Desempenho recalculado",
        description: `${label}: ${data?.processed ?? 0} parlamentares atualizados.`,
      });
    } catch (e) {
      toast({
        title: "Erro ao calcular",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
    setBusy(null);
  };

  const reprocess = async () => {
    setBusy("reprocessar");
    try {
      let total = 0;
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase.functions.invoke("reprocess-proposicoes", {
          body: { limit: 500, offset: i * 500 },
        });
        if (error) throw error;
        total += data?.updated ?? 0;
        if (!data?.updated) break;
      }
      toast({ title: "Proposições reprocessadas", description: `${total} registros atualizados.` });
    } catch (e) {
      toast({
        title: "Erro no reprocessamento",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    }
    setBusy(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={14} className="text-primary" /> Calcular Desempenho (P-Score)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-[11px] text-muted-foreground">
          Recalcula presença, impacto, engajamento e score total para o ano {ano}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            disabled={!!busy}
            onClick={() => run("Câmara", { casa: "camara", ano, limit: 200 })}
          >
            {busy === "Câmara" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Recalcular Câmara (Top 200)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            disabled={!!busy}
            onClick={() => run("Senado", { casa: "senado", ano, limit: 100 })}
          >
            {busy === "Senado" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Recalcular Senado (Top 100)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            disabled={!!busy}
            onClick={reprocess}
          >
            {busy === "reprocessar" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
            Reprocessar Proposições (status + peso)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
