import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tags } from "lucide-react";

interface Props {
  parlamentarId: number;
  casa: "camara" | "senado";
  ano: number;
  max?: number;
  compact?: boolean;
}

interface BadgeRow {
  tema: string;
  total: number;
  sim: number;
  nao: number;
  ratio: number;
  badge: string | null;
}

export function ParlamentarBadgesTema({ parlamentarId, casa, ano, max = 3, compact = false }: Props) {
  const [rows, setRows] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (supabase.rpc as any)("get_parlamentar_badges", { _parlamentar_id: parlamentarId, _casa: casa, _ano: ano })
      .then(({ data }: any) => { if (!cancel) setRows((data || []).filter((r: BadgeRow) => r.badge)); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [parlamentarId, casa, ano]);

  if (loading || rows.length === 0) return null;
  const top = rows.slice(0, max);
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "" : "mt-2"}`}>
      {!compact && <Tags size={10} className="text-muted-foreground self-center" />}
      {top.map((r) => (
        <Badge
          key={r.tema}
          variant="outline"
          className={`text-[9px] font-bold ${r.badge?.startsWith("Pró") ? "border-governo/40 text-governo bg-governo/5" : "border-oposicao/40 text-oposicao bg-oposicao/5"}`}
          title={`${r.sim} a favor / ${r.nao} contra de ${r.total} votos em ${r.tema}`}
        >
          {r.badge}
        </Badge>
      ))}
    </div>
  );
}