import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, TrendingUp, Banknote, Users, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Dep = Tables<"analises_deputados">;
type Sen = Tables<"analises_senadores">;

interface Props {
  ano: number;
  deputados: Dep[];
  senadores: Sen[];
  allYearsDeputados: Dep[];
  allYearsSenadores: Sen[];
}

interface Alerta {
  id: string;
  severity: "critical" | "high" | "medium";
  category: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  meta?: string;
}

const SEV_STYLES: Record<Alerta["severity"], string> = {
  critical: "border-l-4 border-destructive bg-destructive/5",
  high: "border-l-4 border-amber-500 bg-amber-500/5",
  medium: "border-l-4 border-primary bg-primary/5",
};

const SEV_LABEL: Record<Alerta["severity"], string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
};

export function AlertasTab({ ano, deputados, senadores, allYearsDeputados, allYearsSenadores }: Props) {
  const [emendasAlerta, setEmendasAlerta] = useState<Alerta[]>([]);
  const [syncAlerta, setSyncAlerta] = useState<Alerta[]>([]);
  const [loadingEx, setLoadingEx] = useState(true);

  // Mudanças bruscas de alinhamento (>= 20pp) entre o ano e o anterior
  const mudancasAlerts = useMemo<Alerta[]>(() => {
    const prev = ano - 1;
    const out: Alerta[] = [];

    const buildShift = <T extends { ano: number; score: number | string }>(
      list: T[],
      idKey: keyof T,
      nameKey: keyof T,
      partyKey: keyof T,
      casaLabel: string,
    ) => {
      const byYear = new Map<string, Map<any, T>>();
      list.forEach((r) => {
        const k = String(r.ano);
        if (!byYear.has(k)) byYear.set(k, new Map());
        byYear.get(k)!.set(r[idKey], r);
      });
      const cur = byYear.get(String(ano));
      const old = byYear.get(String(prev));
      if (!cur || !old) return;
      cur.forEach((curRow, id) => {
        const oldRow = old.get(id);
        if (!oldRow) return;
        const delta = Number(curRow.score) - Number(oldRow.score);
        if (Math.abs(delta) >= 20) {
          out.push({
            id: `shift-${casaLabel}-${id}`,
            severity: Math.abs(delta) >= 35 ? "critical" : "high",
            category: "Mudança de alinhamento",
            icon: delta > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
            title: `${curRow[nameKey]} (${curRow[partyKey] || "?"}) — ${casaLabel}`,
            detail: `Variação de ${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp em relação a ${prev}.`,
            meta: `${Number(oldRow.score).toFixed(1)}% → ${Number(curRow.score).toFixed(1)}%`,
          });
        }
      });
    };

    buildShift(allYearsDeputados as any, "deputado_id", "deputado_nome", "deputado_partido", "Câmara");
    buildShift(allYearsSenadores as any, "senador_id", "senador_nome", "senador_partido", "Senado");

    return out
      .sort((a, b) => (a.severity === "critical" ? -1 : 1))
      .slice(0, 30);
  }, [allYearsDeputados, allYearsSenadores, ano]);

  // Dissidência extrema vs média do partido (>=25pp)
  const dissidenciaAlerts = useMemo<Alerta[]>(() => {
    const out: Alerta[] = [];

    const build = <T extends { score: number | string; classificacao: string }>(
      list: T[],
      partyKey: keyof T,
      idKey: keyof T,
      nameKey: keyof T,
      casaLabel: string,
    ) => {
      const valid = list.filter((a) => a.classificacao !== "Sem Dados");
      const byParty: Record<string, T[]> = {};
      valid.forEach((a) => {
        const p = String(a[partyKey] || "N/A");
        (byParty[p] = byParty[p] || []).push(a);
      });
      Object.entries(byParty).forEach(([partido, members]) => {
        if (members.length < 4) return;
        const avg = members.reduce((s, m) => s + Number(m.score), 0) / members.length;
        members.forEach((m) => {
          const diff = Number(m.score) - avg;
          if (Math.abs(diff) >= 25) {
            out.push({
              id: `diss-${casaLabel}-${m[idKey]}`,
              severity: Math.abs(diff) >= 40 ? "critical" : "high",
              category: "Dissidência partidária",
              icon: <Users size={16} />,
              title: `${m[nameKey]} (${partido}) — ${casaLabel}`,
              detail: `Score ${Number(m.score).toFixed(1)}% vs média do ${partido} de ${avg.toFixed(1)}%.`,
              meta: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}pp`,
            });
          }
        });
      });
    };

    build(deputados as any, "deputado_partido", "deputado_id", "deputado_nome", "Câmara");
    build(senadores as any, "senador_partido", "senador_id", "senador_nome", "Senado");

    return out
      .sort((a, b) => (a.severity === "critical" ? -1 : 1))
      .slice(0, 30);
  }, [deputados, senadores]);

  // Emendas $ acima de R$ 5M e sync runs com erro recente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEx(true);
      const [emendasRes, syncErrRes] = await Promise.all([
        supabase
          .from("emendas_orcamentarias_transparencia")
          .select("codigo_emenda, ano, nome_autor, partido, casa, valor_empenhado, valor_pago, risco_execucao, tema_ia")
          .eq("ano", ano)
          .gte("valor_empenhado", 5_000_000)
          .order("valor_empenhado", { ascending: false })
          .limit(20),
        supabase
          .from("sync_runs")
          .select("id, casa, ano, status, error, started_at")
          .eq("status", "error")
          .order("started_at", { ascending: false })
          .limit(10),
      ]);
      if (cancelled) return;

      const emAlerts: Alerta[] = (emendasRes.data || []).map((e: any) => ({
        id: `emenda-${e.codigo_emenda}`,
        severity: e.risco_execucao === "Alto" || Number(e.valor_empenhado) >= 20_000_000 ? "critical" : "high",
        category: "Emendas $",
        icon: <Banknote size={16} />,
        title: `${e.nome_autor || "Autor desconhecido"} (${e.partido || "?"}) — ${e.casa || "—"}`,
        detail: `Empenhado: R$ ${Number(e.valor_empenhado).toLocaleString("pt-BR")} • Pago: R$ ${Number(
          e.valor_pago,
        ).toLocaleString("pt-BR")}. Tema: ${e.tema_ia || "Outros"}.`,
        meta: `Risco ${e.risco_execucao || "—"}`,
      }));
      setEmendasAlerta(emAlerts);

      const syAlerts: Alerta[] = (syncErrRes.data || []).map((s: any) => ({
        id: `sync-${s.id}`,
        severity: "medium",
        category: "Sync",
        icon: <Activity size={16} />,
        title: `Falha de sync — ${s.casa} (${s.ano})`,
        detail: s.error || "Erro desconhecido na sincronização.",
        meta: new Date(s.started_at).toLocaleString("pt-BR"),
      }));
      setSyncAlerta(syAlerts);
      setLoadingEx(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ano]);

  const all = useMemo(
    () => [...mudancasAlerts, ...dissidenciaAlerts, ...emendasAlerta, ...syncAlerta],
    [mudancasAlerts, dissidenciaAlerts, emendasAlerta, syncAlerta],
  );

  const counts = useMemo(() => {
    return {
      critical: all.filter((a) => a.severity === "critical").length,
      high: all.filter((a) => a.severity === "high").length,
      medium: all.filter((a) => a.severity === "medium").length,
    };
  }, [all]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-destructive" />
            Alertas — {ano}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <SummaryStat label="Crítico" count={counts.critical} className="bg-destructive/10 text-destructive" />
          <SummaryStat label="Alto" count={counts.high} className="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
          <SummaryStat label="Médio" count={counts.medium} className="bg-primary/10 text-primary" />
        </CardContent>
      </Card>

      <Section title="Mudanças bruscas de alinhamento (≥20pp ano vs anterior)" alerts={mudancasAlerts} />
      <Section title="Dissidência partidária extrema (≥25pp vs média do partido)" alerts={dissidenciaAlerts} />
      <Section
        title="Emendas orçamentárias acima de R$ 5M"
        alerts={emendasAlerta}
        loading={loadingEx}
        emptyHint="Sem emendas $ alarmantes para este ano (ou Portal da Transparência ainda sem dados)."
      />
      <Section title="Falhas recentes de sincronização" alerts={syncAlerta} loading={loadingEx} />
    </div>
  );
}

function SummaryStat({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <div className={`p-3 rounded-xl text-center ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-2xl font-black">{count}</p>
    </div>
  );
}

function Section({
  title,
  alerts,
  loading,
  emptyHint,
}: {
  title: string;
  alerts: Alerta[];
  loading?: boolean;
  emptyHint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">
            {emptyHint || "Nenhum alerta neste critério."}
          </p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className={`p-3 rounded-lg ${SEV_STYLES[a.severity]}`}>
              <div className="flex items-start gap-2">
                <div className="mt-0.5 text-foreground/70">{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px]">{a.category}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{SEV_LABEL[a.severity]}</Badge>
                    {a.meta && <span className="text-[10px] font-bold text-muted-foreground">{a.meta}</span>}
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-1">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
