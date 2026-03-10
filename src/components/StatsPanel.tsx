import {
  UserCheck, UserX, UserMinus, Minus, BarChart2, Info, Loader2, Clock, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface StatsPanelProps {
  analises: Analise[];
  totalDeputados: number;
  syncing: boolean;
  onSync: () => void;
  user?: any;
  lastSync?: Date | null;
  canSync?: boolean;
  remainingSeconds?: number;
}

function StatItem({ label, count, icon, colorClass }: {
  label: string; count: number; icon: React.ReactNode; colorClass: string;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${colorClass}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-card/50">{icon}</div>
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-lg font-black">{count}</span>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatLastSync(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function StatsPanel({
  analises, totalDeputados, syncing, onSync, user,
  lastSync, canSync = true, remainingSeconds = 0,
}: StatsPanelProps) {
  const counts = { Governo: 0, Centro: 0, Oposição: 0, "Sem Dados": 0 };
  analises.forEach((a) => {
    if (counts[a.classificacao] !== undefined) counts[a.classificacao]++;
  });

  const progress = totalDeputados > 0 ? (analises.length / totalDeputados) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Resumo da Base
            </CardTitle>
            {syncing && <Loader2 size={14} className="animate-spin text-primary" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatItem label="Governo" count={counts.Governo} icon={<UserCheck size={16} className="text-governo" />} colorClass="bg-governo/10 text-governo" />
          <StatItem label="Centro" count={counts.Centro} icon={<UserMinus size={16} className="text-centro" />} colorClass="bg-centro/10 text-centro" />
          <StatItem label="Oposição" count={counts.Oposição} icon={<UserX size={16} className="text-oposicao" />} colorClass="bg-oposicao/10 text-oposicao" />
          <StatItem label="Por Analisar" count={Math.max(0, totalDeputados - analises.length)} icon={<Minus size={16} className="text-muted-foreground" />} colorClass="bg-muted text-muted-foreground" />

          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Análise</span>
              <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {user && (
            <>
              {/* Sync status indicator */}
              {lastSync && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2">
                  <Clock size={12} />
                  <span>Última sync: <strong className="text-foreground">{formatLastSync(lastSync)}</strong></span>
                </div>
              )}

              {!canSync && remainingSeconds > 0 && (
                <div className="flex items-center gap-2 bg-accent/50 text-accent-foreground p-2.5 rounded-lg">
                  <Timer size={14} className="text-primary animate-pulse" />
                  <span className="text-[11px] font-bold">
                    Próxima sync em <span className="text-primary font-black">{formatTime(remainingSeconds)}</span>
                  </span>
                </div>
              )}

              <Button className="w-full mt-3" onClick={onSync} disabled={syncing || !canSync}>
                {syncing ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <BarChart2 className="mr-2" size={14} />
                )}
                {syncing ? "Sincronizando..." : !canSync ? `Aguarde ${formatTime(remainingSeconds)}` : "Sincronizar via Backend"}
              </Button>
              <p className="text-[9px] text-center text-muted-foreground font-bold uppercase">
                Busca votações → orientações do governo → votos dos deputados
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-5">
          <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3 flex items-center gap-2">
            <Info size={14} /> Metodologia
          </h4>
          <div className="space-y-2 text-[11px] font-semibold">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-governo" /> GOVERNO: Alinhamento {"> "}50%</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-centro" /> CENTRÃO: Alinhamento 30–50%</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-oposicao" /> OPOSIÇÃO: Alinhamento {"≤ "}30%</div>
          </div>
          <p className="text-[10px] mt-3 leading-relaxed opacity-70">
            Análise das últimas 30 votações de cada deputado, comparando com a orientação do líder do governo no ano selecionado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
