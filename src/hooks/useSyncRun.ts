import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SyncEvent {
  id: string;
  step: string;
  message: string;
  created_at: string;
}

interface SyncRunState {
  runId: string | null;
  status: "idle" | "running" | "completed" | "error";
  events: SyncEvent[];
  error: string | null;
}

export function useSyncRun() {
  const [state, setState] = useState<SyncRunState>({
    runId: null, status: "idle", events: [], error: null,
  });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollEvents = useCallback(async (runId: string) => {
    // Fetch events
    const { data: events } = await supabase
      .from("sync_run_events")
      .select("id, step, message, created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    // Fetch run status
    const { data: runs } = await supabase
      .from("sync_runs")
      .select("status, error")
      .eq("id", runId)
      .limit(1);

    const run = runs?.[0];
    const isDone = run?.status === "completed" || run?.status === "error";

    setState((prev) => ({
      ...prev,
      events: (events as SyncEvent[]) || prev.events,
      status: isDone ? run.status as "completed" | "error" : prev.status,
      error: run?.error || prev.error,
    }));

    return isDone;
  }, []);

  const startRun = useCallback((runId: string) => {
    setState({ runId, status: "running", events: [], error: null });

    // Poll every 3 seconds
    const interval = setInterval(async () => {
      const done = await pollEvents(runId);
      if (done) {
        clearInterval(interval);
      }
    }, 3000);

    pollingRef.current = interval;
  }, [pollEvents]);

  const finishRun = useCallback((status: "completed" | "error", error?: string) => {
    setState((prev) => ({ ...prev, status, error: error || null }));
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setState({ runId: null, status: "idle", events: [], error: null });
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return { ...state, startRun, finishRun, reset };
}
