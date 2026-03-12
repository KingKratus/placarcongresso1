import { useRef, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, Info } from "lucide-react";

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
}

function getStepIcon(step: string, isLast: boolean, status: string) {
  if (step === "error") return <XCircle size={12} className="text-destructive shrink-0" />;
  if (step === "concluido") return <CheckCircle2 size={12} className="text-governo shrink-0" />;
  if (isLast && status === "running") return <Loader2 size={12} className="animate-spin text-primary shrink-0" />;
  return <Info size={12} className="text-muted-foreground shrink-0" />;
}

export function SyncLogViewer({ events, status, error }: Props) {
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
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto p-2 space-y-1">
        {events.map((e, i) => (
          <div key={e.id} className="flex items-start gap-1.5">
            {getStepIcon(e.step, i === events.length - 1, status)}
            <span className="text-[11px] text-foreground leading-tight">{e.message}</span>
          </div>
        ))}
        {status === "running" && events.length === 0 && (
          <div className="flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground">Conectando...</span>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-1.5">
            <XCircle size={12} className="text-destructive shrink-0" />
            <span className="text-[11px] text-destructive">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
