import { useRef, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, Info, Database, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncEvent {
  id: string;
  step: string;
  message: string;
  created_at: string;
}

interface Props {
  events: SyncEvent[];
  status: "idle" | "running" | "completed" | "error";
  error: string | null;
  onRetry?: () => void;
}

function getStepIcon(step: string, isLast: boolean, status: string) {
  if (step === "error") return <XCircle size={12} className="text-destructive shrink-0" />;
  if (step === "cache_hit" || step === "cache_summary") return <Database size={12} className="text-blue-500 shrink-0" />;
  if (step === "adaptive") return <AlertTriangle size={12} className="text-amber-500 shrink-0" />;
  if (step === "concluido") return <CheckCircle2 size={12} className="text-governo shrink-0" />;
  if (isLast && status === "running") return <Loader2 size={12} className="animate-spin text-primary shrink-0" />;
  return <Info size={12} className="text-muted-foreground shrink-0" />;
}

function diagnoseError(err: string): { hint: string; tone: "rate" | "timeout" | "json" | "other" } {
  const e = err.toLowerCase();
  if (e.includes("limite diário") || e.includes("rate") || e.includes("429")) return { hint: "Cota diária do Portal esgotada. Aguarde até 00:00 ou use cache.", tone: "rate" };
  if (e.includes("timeout") || e.includes("demorou")) return { hint: "Portal está lento. Tente novamente com menos páginas.", tone: "timeout" };
  if (e.includes("não json") || e.includes("non json")) return { hint: "Resposta inválida do Portal. Verifique chave de API.", tone: "json" };
  return { hint: "Erro inesperado. Confira o log abaixo.", tone: "other" };
}

export function SyncLogViewer({ events, status, error, onRetry }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0 && status === "idle") return null;

  return (
    <div className="mt-3 border border-border rounded-lg bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Log de Sincronização
        </span>
        {status === "running" && (
          <Loader2 size={10} className="animate-spin text-primary" />
        )}
        {status === "completed" && (
          <CheckCircle2 size={10} className="text-governo" />
        )}
        {status === "error" && (
          <XCircle size={10} className="text-destructive" />
        )}
      </div>
      {status === "error" && error && (
        <div className="px-3 py-2 border-b border-destructive/20 bg-destructive/5 text-[11px] flex items-start gap-2">
          <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-destructive break-words">{error}</p>
            <p className="text-muted-foreground mt-0.5">{diagnoseError(error).hint}</p>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 shrink-0" onClick={onRetry}>
              <RotateCcw size={10} /> Tentar novamente
            </Button>
          )}
        </div>
      )}
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto p-2 space-y-1">
        {events.map((e, i) => (
          <div key={e.id} className="flex items-start gap-1.5">
            {getStepIcon(e.step, i === events.length - 1, status)}
            <span className="text-[11px] text-foreground leading-tight flex-1">
              {(e.step === "cache_hit" || e.step === "cache_summary") && (
                <span className="inline-flex items-center px-1 mr-1 rounded bg-blue-500/10 text-blue-600 text-[9px] font-bold uppercase">cache</span>
              )}
              {e.step === "adaptive" && (
                <span className="inline-flex items-center px-1 mr-1 rounded bg-amber-500/10 text-amber-600 text-[9px] font-bold uppercase">adapt</span>
              )}
              {e.message}
            </span>
          </div>
        ))}
        {status === "running" && events.length === 0 && (
          <div className="flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground">Conectando...</span>
          </div>
        )}
        {error && status !== "error" && (
          <div className="flex items-start gap-1.5">
            <XCircle size={12} className="text-destructive shrink-0" />
            <span className="text-[11px] text-destructive">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
