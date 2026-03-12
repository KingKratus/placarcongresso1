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
  const channelRef = useRef<any>(null);

  const startRun = useCallback((runId: string) => {
    setState({ runId, status: "running", events: [], error: null });

    // Subscribe to realtime events for this run
    const channel = supabase
      .channel(`sync-run-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sync_run_events",
          filter: `run_id=eq.${runId}`,
        },
        (payload: any) => {
          const event = payload.new as SyncEvent;
          setState((prev) => ({
            ...prev,
            events: [...prev.events, event],
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sync_runs",
          filter: `id=eq.${runId}`,
        },
        (payload: any) => {
          const run = payload.new;
          if (run.status === "completed" || run.status === "error") {
            setState((prev) => ({
              ...prev,
              status: run.status,
              error: run.error || null,
            }));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, []);

  const finishRun = useCallback((status: "completed" | "error", error?: string) => {
    setState((prev) => ({ ...prev, status, error: error || null }));
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setState({ runId: null, status: "idle", events: [], error: null });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return { ...state, startRun, finishRun, reset };
}
