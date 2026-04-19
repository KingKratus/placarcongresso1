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
  const [logs, setLogs] = useState<string[]>([]);

  const log = (line: string) =>
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString("pt-BR")}] ${line}`]);

  const run = async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    setLogs([]);
    log(`▶ ${label}: iniciando recálculo de P-Score (ano=${ano})...`);
    try {
      const t0 = Date.now();
      const { data, error } = await supabase.functions.invoke("calculate-performance", { body });
      if (error) throw error;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const processed = data?.processed ?? 0;
      log(`✓ ${label}: ${processed} parlamentares processados em ${elapsed}s`);
      toast({
        title: "Desempenho recalculado",
        description: `${label}: ${processed} parlamentares atualizados.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      log(`✗ ${label}: ${msg}`);
      toast({ title: "Erro ao calcular", description: msg, variant: "destructive" });
    }
    setBusy(null);
  };

  const reprocess = async () => {
    setBusy("reprocessar");
    setLogs([]);
    log("▶ Reprocessamento de proposições iniciado (lotes de 500)...");
    try {
      let total = 0;
      for (let i = 0; i < 5; i++) {
        log(`→ Lote ${i + 1}/5: offset=${i * 500}`);
        const { data, error } = await supabase.functions.invoke("reprocess-proposicoes", {
          body: { limit: 500, offset: i * 500 },
        });
        if (error) throw error;
        const updated = data?.updated ?? 0;
        total += updated;
        log(`  ✓ ${updated} registros atualizados (total acumulado: ${total})`);
        if (!updated) {
          log("  ⚠ Sem mais registros para processar — encerrando");
          break;
        }
      }
      log(`✓ Reprocessamento concluído: ${total} registros totais atualizados`);
      toast({ title: "Proposições reprocessadas", description: `${total} registros atualizados.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      log(`✗ Erro: ${msg}`);
      toast({ title: "Erro no reprocessamento", description: msg, variant: "destructive" });
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
        {logs.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto bg-muted/40 rounded p-2 text-[10px] font-mono space-y-0.5 border border-border">
            {logs.map((l, i) => (
              <div
                key={i}
                className={
                  l.includes("✗") ? "text-destructive"
                  : l.includes("✓") ? "text-emerald-600 dark:text-emerald-400"
                  : l.includes("⚠") ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
                }
              >
                {l}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
