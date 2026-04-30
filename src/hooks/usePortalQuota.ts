import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortalQuota {
  date: string;
  used: number;
  limit: number;
  cacheHits24h: number;
  cacheTotal: number;
}

export function usePortalQuota() {
  const [quota, setQuota] = useState<PortalQuota | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: q }, { count: total }, { data: hits }] = await Promise.all([
      supabase.from("portal_api_quota").select("*").eq("date", today).maybeSingle(),
      supabase.from("sync_query_cache").select("*", { count: "exact", head: true }),
      supabase.from("sync_query_cache").select("hit_count").gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    ]);
    const cacheHits = (hits || []).reduce((s: number, r: any) => s + (r.hit_count || 0), 0);
    setQuota({
      date: today,
      used: q?.requests_used ?? 0,
      limit: q?.daily_limit ?? 600,
      cacheHits24h: cacheHits,
      cacheTotal: total || 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { quota, loading, refresh };
}