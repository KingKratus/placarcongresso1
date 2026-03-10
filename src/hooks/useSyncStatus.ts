import { useState, useEffect, useCallback } from "react";
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

  const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

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
      // Check for any last sync (even older)
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

  // Fetch on mount and after changes
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    if (status.remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setStatus((prev) => {
        const newRemaining = Math.max(0, prev.remainingSeconds - 1);
        return {
          ...prev,
          remainingSeconds: newRemaining,
          canSync: newRemaining === 0,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status.remainingSeconds > 0]);

  return { ...status, refetchStatus: fetchStatus };
}
