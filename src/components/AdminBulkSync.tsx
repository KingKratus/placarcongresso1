import { useState, useEffect } from "react";
import { Shield, Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

interface BulkSyncResult {
  casa: string;
  ano: number;
  status: "pending" | "running" | "completed" | "error";
  error?: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = [CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR];

interface Props {
  userId: string;
}

export function AdminBulkSync({ userId }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedYears, setSelectedYears] = useState<number[]>([...AVAILABLE_YEARS]);
  const [syncCamara, setSyncCamara] = useState(true);
  const [syncSenado, setSyncSenado] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BulkSyncResult[]>([]);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", { _role: "admin" });
      setIsAdmin(!!data);
      setLoading(false);
    };
    checkAdmin();
  }, [userId]);

  if (loading || !isAdmin) return null;

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort()
    );
  };

  const buildQueue = (): BulkSyncResult[] => {
    const queue: BulkSyncResult[] = [];
    const sortedYears = [...selectedYears].sort();
    for (const ano of sortedYears) {
      if (syncCamara) queue.push({ casa: "camara", ano, status: "pending" });
      if (syncSenado) queue.push({ casa: "senado", ano, status: "pending" });
    }
    return queue;
  };

  const runBulkSync = async () => {
    const queue = buildQueue();
    if (queue.length === 0) return;
    setRunning(true);
    setResults(queue);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const updated = [...queue];
      updated[i] = { ...item, status: "running" };
      setResults([...updated]);

      try {
        const fnName = item.casa === "camara" ? "sync-camara" : "sync-senado";
        const runId = crypto.randomUUID();
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: { ano: item.ano, run_id: runId },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        updated[i] = { ...item, status: "completed" };
      } catch (e: any) {
        updated[i] = { ...item, status: "error", error: e.message };
      }
      setResults([...updated]);
    }
    setRunning(false);
  };

  const totalJobs = (syncCamara ? selectedYears.length : 0) + (syncSenado ? selectedYears.length : 0);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <Shield size={14} /> Sync Admin (Multi-Ano)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Anos</span>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_YEARS.map((year) => (
              <label key={year} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedYears.includes(year)}
                  onCheckedChange={() => toggleYear(year)}
                  disabled={running}
                />
                <span className="text-xs font-bold">{year}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Casas</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox checked={syncCamara} onCheckedChange={(v) => setSyncCamara(!!v)} disabled={running} />
              <span className="text-xs font-bold">Câmara</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox checked={syncSenado} onCheckedChange={(v) => setSyncSenado(!!v)} disabled={running} />
              <span className="text-xs font-bold">Senado</span>
            </label>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={runBulkSync}
          disabled={running || totalJobs === 0}
        >
          {running ? (
            <Loader2 className="animate-spin mr-2" size={14} />
          ) : (
            <Play className="mr-2" size={14} />
          )}
          {running ? "Sincronizando..." : `Sincronizar ${totalJobs} job${totalJobs !== 1 ? "s" : ""}`}
        </Button>

        {results.length > 0 && (
          <div className="space-y-1 mt-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-[11px] ${
                r.status === "error" ? "bg-destructive/10" : r.status === "completed" ? "bg-governo/5" : r.status === "running" ? "bg-primary/5" : "bg-muted/30"
              }`}>
                {r.status === "completed" && <CheckCircle2 size={12} className="text-governo shrink-0" />}
                {r.status === "error" && <XCircle size={12} className="text-destructive shrink-0" />}
                {r.status === "running" && <Loader2 size={12} className="animate-spin text-primary shrink-0" />}
                {r.status === "pending" && <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                <span className={`font-black uppercase text-[9px] tracking-wider px-1.5 py-0.5 rounded ${
                  r.casa === "camara" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                }`}>
                  {r.casa === "camara" ? "CÂM" : "SEN"}
                </span>
                <span className="font-bold">{r.ano}</span>
                {r.error && <span className="text-destructive truncate flex-1">{r.error}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
