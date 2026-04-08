import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

interface SyncRun {
  id: string;
  casa: string;
  ano: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  summary: Record<string, any> | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function durationStr(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 size={14} className="text-governo shrink-0" />;
  if (status === "error") return <XCircle size={14} className="text-destructive shrink-0" />;
  if (status === "running") return <Loader2 size={14} className="animate-spin text-primary shrink-0" />;
  return <Clock size={14} className="text-muted-foreground shrink-0" />;
}

export function SyncHistoryPanel() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sync_runs")
      .select("id, casa, ano, status, started_at, finished_at, error, summary")
      .order("started_at", { ascending: false })
      .limit(30);
    setRuns((data as SyncRun[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchRuns();
  }, [open]);

  const successCount = runs.filter(r => r.status === "completed").length;
  const errorCount = runs.filter(r => r.status === "error").length;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <RefreshCw size={14} /> Histórico de Syncs
              </CardTitle>
              <div className="flex items-center gap-2">
                {!loading && runs.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold">
                    <span className="text-governo">{successCount}✓</span>
                    {errorCount > 0 && <span className="text-destructive">{errorCount}✗</span>}
                  </div>
                )}
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-primary" />
              </div>
            ) : runs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">Nenhuma sync registrada</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {runs.map((run) => (
                  <div key={run.id} className={`flex items-center gap-2 p-2 rounded-lg text-[11px] ${
                    run.status === "error" ? "bg-destructive/5" : run.status === "completed" ? "bg-governo/5" : "bg-muted/30"
                  }`}>
                    <StatusIcon status={run.status} />
                    <span className={`font-black uppercase text-[9px] tracking-wider px-1.5 py-0.5 rounded ${
                      run.casa === "camara" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                    }`}>
                      {run.casa === "camara" ? "CÂM" : "SEN"}
                    </span>
                    <span className="font-bold text-muted-foreground">{run.ano}</span>
                    <span className="text-muted-foreground flex-1 truncate">
                      {formatDate(run.started_at)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {durationStr(run.started_at, run.finished_at)}
                    </span>
                    {run.summary && (
                      <span className="text-[9px] font-bold text-foreground">
                        {(run.summary as any).analyzed || "—"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
