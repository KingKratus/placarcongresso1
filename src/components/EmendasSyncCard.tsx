import { useState, useEffect } from "react";
import { DollarSign, Loader2, Play, CheckCircle2, XCircle, AlertTriangle, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePortalQuota } from "@/hooks/usePortalQuota";
import { useToast } from "@/hooks/use-toast";

const CURRENT_YEAR = new Date().getFullYear();
const ANOS = (() => {
  const ys: number[] = [];
  for (let y = 2014; y <= CURRENT_YEAR; y++) ys.push(y);
  return ys.reverse();
})();

interface YearResult {
  ano: number;
  status: "pending" | "running" | "ok" | "empty" | "error";
  fetched?: number;
  upserted?: number;
  empty_reason?: string | null;
  error?: string;
}

/**
 * Card para sync manual de Emendas $ (Portal da Transparência).
 * Suporta:
 *  - Sincronizar um ano específico
 *  - Varredura automática (do mais recente até esgotar 3 anos consecutivos vazios ou quota acabar)
 */
export function EmendasSyncCard() {
  const { toast } = useToast();
  const { quota, refresh: refreshQuota } = usePortalQuota();
  const [singleAno, setSingleAno] = useState(CURRENT_YEAR);
  const [paginas, setPaginas] = useState(3);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<YearResult[]>([]);

  useEffect(() => { const i = setInterval(refreshQuota, 5000); return () => clearInterval(i); }, [refreshQuota]);

  const remaining = quota ? Math.max(0, quota.limit - quota.used) : null;

  const syncOne = async (ano: number): Promise<YearResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("sync-emendas-transparencia", {
        body: { ano, paginas, tentarAnoAnterior: false },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro");
      const fetched = data?.fetched ?? 0;
      return {
        ano, status: fetched > 0 ? "ok" : "empty",
        fetched, upserted: data?.upserted ?? 0, empty_reason: data?.empty_reason ?? null,
      };
    } catch (e: any) {
      return { ano, status: "error", error: e.message };
    }
  };

  const runSingle = async () => {
    setRunning(true);
    setProgress([{ ano: singleAno, status: "running" }]);
    const r = await syncOne(singleAno);
    setProgress([r]);
    await refreshQuota();
    setRunning(false);
    toast({
      title: r.status === "ok" ? "Sync concluído" : r.status === "empty" ? "Sem dados" : "Erro no sync",
      description: r.status === "ok" ? `${r.upserted} emendas gravadas em ${r.ano}.` :
        r.status === "empty" ? (r.empty_reason || `Portal sem dados para ${r.ano}.`) : r.error,
      variant: r.status === "error" ? "destructive" : "default",
    });
  };

  const runVarredura = async () => {
    setRunning(true);
    const queue: YearResult[] = ANOS.map((ano) => ({ ano, status: "pending" }));
    setProgress(queue);
    let consecutiveEmpty = 0;
    for (let i = 0; i < queue.length; i++) {
      // checa quota
      await refreshQuota();
      if (quota && (quota.limit - quota.used) < 3) {
        queue[i] = { ...queue[i], status: "error", error: "Quota diária quase esgotada — interrompido." };
        setProgress([...queue]);
        break;
      }
      queue[i] = { ...queue[i], status: "running" };
      setProgress([...queue]);
      const r = await syncOne(queue[i].ano);
      queue[i] = r;
      setProgress([...queue]);
      if (r.status === "empty") consecutiveEmpty++;
      else if (r.status === "ok") consecutiveEmpty = 0;
      if (consecutiveEmpty >= 3) {
        // marca os anos restantes como não tentados
        for (let j = i + 1; j < queue.length; j++) queue[j] = { ...queue[j], status: "pending", error: "Pulado: 3 anos consecutivos sem dados." };
        setProgress([...queue]);
        break;
      }
    }
    await refreshQuota();
    setRunning(false);
    toast({ title: "Varredura concluída", description: "Veja os resultados ano a ano abaixo." });
  };

  const completedCount = progress.filter((p) => p.status === "ok").length;
  const totalAttempted = progress.filter((p) => p.status !== "pending").length;
  const pct = totalAttempted > 0 ? Math.round((totalAttempted / progress.length) * 100) : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <DollarSign size={14} /> Sync Emendas $ (Portal da Transparência)
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Quota hoje: <b>{quota?.used ?? 0}/{quota?.limit ?? 600}</b>{" "}
          {remaining !== null && <span className={remaining < 50 ? "text-destructive font-bold" : ""}>({remaining} disponíveis)</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Ano</label>
            <Select value={String(singleAno)} onValueChange={(v) => setSingleAno(Number(v))}>
              <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Páginas</label>
            <Select value={String(paginas)} onValueChange={(v) => setPaginas(Number(v))}>
              <SelectTrigger className="h-9 w-[90px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 5, 7, 10].map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={runSingle} disabled={running} className="gap-1">
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Sincronizar ano
          </Button>
          <Button size="sm" variant="outline" onClick={runVarredura} disabled={running} className="gap-1">
            <Search size={12} /> Varrer todos os anos
          </Button>
        </div>

        {progress.length > 0 && (
          <div className="space-y-2">
            {progress.length > 1 && (
              <>
                <Progress value={pct} className="h-2" />
                <p className="text-[10px] text-muted-foreground">
                  {totalAttempted}/{progress.length} anos · {completedCount} com dados
                </p>
              </>
            )}
            <div className="space-y-1 max-h-[280px] overflow-auto">
              {progress.map((r) => (
                <div key={r.ano} className={`flex items-center gap-2 p-2 rounded text-[11px] ${
                  r.status === "error" ? "bg-destructive/10" :
                  r.status === "ok" ? "bg-governo/5" :
                  r.status === "empty" ? "bg-muted/40" :
                  r.status === "running" ? "bg-primary/5" : "bg-muted/20"
                }`}>
                  {r.status === "ok" && <CheckCircle2 size={12} className="text-governo shrink-0" />}
                  {r.status === "empty" && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                  {r.status === "error" && <XCircle size={12} className="text-destructive shrink-0" />}
                  {r.status === "running" && <Loader2 size={12} className="animate-spin text-primary shrink-0" />}
                  {r.status === "pending" && <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                  <Badge variant="outline" className="text-[9px] font-bold">{r.ano}</Badge>
                  {r.status === "ok" && <span className="text-governo font-bold">{r.upserted} emendas</span>}
                  {r.status === "empty" && <span className="text-amber-700 truncate">{r.empty_reason || "Sem dados"}</span>}
                  {r.error && <span className="text-destructive truncate">{r.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}