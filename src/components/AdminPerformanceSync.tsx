import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, RefreshCcw, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { streamPerformance } from "@/lib/streamPerformance";
import { LiveScoreChart } from "./LiveScoreChart";

interface Props {
  ano: number;
}

export function AdminPerformanceSync({ ano }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [points, setPoints] = useState<{ i: number; score: number; nome?: string | null }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const log = (line: string) =>
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString("pt-BR")}] ${line}`]);

  const stop = () => {
    abortRef.current?.abort();
    log("⏹ Cancelado pelo usuário");
    setBusy(null);
  };

  const run = async (label: string, body: { casa: "camara" | "senado"; ano: number }) => {
    setBusy(label);
    setLogs([]);
    setProgress(null);
    setPoints([]);
    log(`▶ ${label}: abrindo stream de P-Score (ano=${ano}, processando 100%)...`);
    const t0 = Date.now();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let processed = 0;
      await streamPerformance({
        casa: body.casa,
        ano: body.ano,
        signal: ctrl.signal,
        // limit omitted -> backend defaults to 1000 (covers full house)
        onEvent: (e) => {
          if (e.type === "start") {
            log(`→ ${e.total} parlamentares na fila${e.run_id ? ` · run_id=${e.run_id.slice(0, 8)}` : ""}`);
            setProgress({ current: 0, total: e.total });
          } else if (e.type === "progress") {
            setProgress({ current: e.current, total: e.total });
            setPoints((p) => [...p, { i: e.current, score: e.score_total, nome: e.nome }]);
            if (e.current % 10 === 0 || e.current === e.total) {
              log(`  · ${e.current}/${e.total} — ${e.nome ?? "?"} (${e.partido}/${e.uf}) score=${e.score_total.toFixed(1)}`);
            }
          } else if (e.type === "flush") {
            log(`  💾 lote gravado (${e.upserted}, acumulado ${e.accumulated})`);
          } else if (e.type === "done") {
            processed = e.processed;
          } else if (e.type === "error") {
            throw new Error(e.message);
          }
        },
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      log(`✓ ${label}: ${processed} parlamentares processados em ${elapsed}s`);
      toast({
        title: "Desempenho recalculado",
        description: `${label}: ${processed} parlamentares atualizados em ${elapsed}s.`,
      });
    } catch (e) {
      if ((e as any)?.name === "AbortError") {
        log(`⏹ ${label}: cancelado`);
      } else {
        const msg = e instanceof Error ? e.message : "Erro desconhecido";
        log(`✗ ${label}: ${msg}`);
        toast({ title: "Erro ao calcular", description: msg, variant: "destructive" });
      }
    }
    setBusy(null);
    abortRef.current = null;
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
        log(`  ✓ ${updated} registros atualizados (acumulado: ${total})`);
        if (!updated) {
          log("  ⚠ Sem mais registros — encerrando");
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
          Recalcula presença, impacto, engajamento e score total para o ano {ano} — processa 100% dos parlamentares (Câmara: 513, Senado: 81).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            disabled={!!busy}
            onClick={() => run("Câmara", { casa: "camara", ano })}
          >
            {busy === "Câmara" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Recalcular Câmara (100%)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            disabled={!!busy}
            onClick={() => run("Senado", { casa: "senado", ano })}
          >
            {busy === "Senado" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Recalcular Senado (100%)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            disabled={!!busy}
            onClick={reprocess}
          >
            {busy === "reprocessar" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
            Reprocessar Proposições
          </Button>
          {busy && busy !== "reprocessar" && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs gap-1"
              onClick={stop}
            >
              <Square size={12} /> Parar
            </Button>
          )}
        </div>
        {progress && progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>Progresso</span>
              <span>{progress.current}/{progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
          </div>
        )}
        {points.length > 0 && <LiveScoreChart points={points} />}
        {logs.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto bg-muted/40 rounded p-2 text-[10px] font-mono space-y-0.5 border border-border">
            {logs.map((l, i) => (
              <div
                key={i}
                className={
                  l.includes("✗") ? "text-destructive"
                  : l.includes("✓") ? "text-emerald-600 dark:text-emerald-400"
                  : l.includes("💾") ? "text-blue-600 dark:text-blue-400"
                  : l.includes("⚠") ? "text-amber-600 dark:text-amber-400"
                  : l.includes("⏹") ? "text-amber-600 dark:text-amber-400"
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
