import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SyncStatus {
  lastSync: Date | null;
  canSync: boolean;
  remainingSeconds: number;
}

export function useSyncStatus(casa: "camara" | "senado", userId?: string) {
  const [status, setStatus] = useState<SyncStatus>({
    lastSync: null,
    canSync: true,
    remainingSeconds: 0,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const COOLDOWN_MS = 10 * 60 * 1000;

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setStatus({ lastSync: null, canSync: true, remainingSeconds: 0 });
      return;
    }

    const tenMinAgo = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { data } = await supabase
      .from("sync_logs")
      .select("created_at")
      .eq("user_id", userId)
      .eq("casa", casa)
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastSync = new Date(data[0].created_at);
      const nextAvailable = lastSync.getTime() + COOLDOWN_MS;
      const remaining = Math.max(0, Math.ceil((nextAvailable - Date.now()) / 1000));
      setStatus({
        lastSync,
        canSync: remaining === 0,
        remainingSeconds: remaining,
      });
    } else {
      const { data: anySync } = await supabase
        .from("sync_logs")
        .select("created_at")
        .eq("user_id", userId)
        .eq("casa", casa)
        .order("created_at", { ascending: false })
        .limit(1);

      setStatus({
        lastSync: anySync?.[0] ? new Date(anySync[0].created_at) : null,
        canSync: true,
        remainingSeconds: 0,
      });
    }
  }, [userId, casa]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Countdown timer — use a stable ref-based approach
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (status.remainingSeconds <= 0) return;

    timerRef.current = setInterval(() => {
      setStatus((prev) => {
        const newRemaining = Math.max(0, prev.remainingSeconds - 1);
        if (newRemaining === 0 && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return {
          ...prev,
          remainingSeconds: newRemaining,
          canSync: newRemaining === 0,
        };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status.remainingSeconds > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...status, refetchStatus: fetchStatus };
}
