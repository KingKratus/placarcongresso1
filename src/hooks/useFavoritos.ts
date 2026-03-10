import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFavoritos(userId?: string) {
  const [favoritos, setFavoritos] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavoritos = useCallback(async () => {
    if (!userId) {
      setFavoritos([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("favoritos")
      .eq("user_id", userId)
      .single();

    setFavoritos(data?.favoritos || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchFavoritos();
  }, [fetchFavoritos]);

  const toggleFavorito = useCallback(
    async (parlamentarId: number) => {
      if (!userId) return;

      const newFavoritos = favoritos.includes(parlamentarId)
        ? favoritos.filter((id) => id !== parlamentarId)
        : [...favoritos, parlamentarId];

      setFavoritos(newFavoritos);

      await supabase
        .from("profiles")
        .update({ favoritos: newFavoritos })
        .eq("user_id", userId);
    },
    [userId, favoritos]
  );

  const isFavorito = useCallback(
    (parlamentarId: number) => favoritos.includes(parlamentarId),
    [favoritos]
  );

  return { favoritos, loading, toggleFavorito, isFavorito, refetch: fetchFavoritos };
}
