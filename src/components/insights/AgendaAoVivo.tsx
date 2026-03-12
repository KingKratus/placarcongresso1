import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Clock, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CamaraEvento {
  id: number;
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string | null;
  situacao: string;
  orgaos: string[];
  localCamara: string;
}

interface CamaraVotacao {
  id: string;
  data: string;
  descricao: string;
  siglaOrgao: string;
  aprovacao: number | null;
}

interface SenadoSessao {
  dataSessao: string;
  tipo: string;
  situacao: string;
  materias: { sigla: string; numero: string; ano: string; ementa: string; resultado: string }[];
}

interface AgendaData {
  atualizado_em: string;
  camara: {
    eventos_hoje: number;
    em_andamento: CamaraEvento[];
    proximos: CamaraEvento[];
    votacoes_hoje: CamaraVotacao[];
  };
  senado: {
    sessoes_hoje: SenadoSessao[];
  };
}

const CAMARA_COLOR = "hsl(239, 84%, 67%)";
const SENADO_COLOR = "hsl(160, 84%, 39%)";

export function AgendaAoVivo() {
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAgenda = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke("agenda-live");
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
      setLastUpdate(new Date());
    } catch (e: any) {
      setError(e.message || "Erro ao buscar agenda");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgenda();
    const interval = setInterval(fetchAgenda, 3 * 60 * 1000); // 3 min
    return () => clearInterval(interval);
  }, [fetchAgenda]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <AlertCircle size={32} className="mx-auto text-destructive" />
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAgenda}>
            <RefreshCw size={14} className="mr-2" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasLiveEvents = (data?.camara.em_andamento.length || 0) > 0;
  const hasTodayVotes = (data?.camara.votacoes_hoje.length || 0) > 0;
  const hasSenadoSessions = (data?.senado.sessoes_hoje.length || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasLiveEvents ? (
            <Badge className="bg-destructive text-destructive-foreground gap-1 animate-pulse">
              <Radio size={10} /> AO VIVO
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Clock size={10} /> Sem sessão ativa
            </Badge>
          )}
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              Atualizado {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAgenda} disabled={loading} className="gap-1 h-7">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {/* Live events */}
      {hasLiveEvents && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio size={14} className="text-destructive animate-pulse" />
              Em Andamento — Câmara
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data!.camara.em_andamento.map((e) => (
              <div key={e.id} className="p-3 rounded-lg border border-border bg-card">
                <p className="text-sm font-semibold text-foreground">{e.descricao || e.titulo}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {e.orgaos.map((o, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{o}</Badge>
                  ))}
                  {e.localCamara && (
                    <span className="text-[10px] text-muted-foreground">{e.localCamara}</span>
                  )}
                  {e.dataInicio && (
                    <span className="text-[10px] text-muted-foreground">
                      Início: {new Date(e.dataInicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's votes */}
      {hasTodayVotes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText size={14} style={{ color: CAMARA_COLOR }} />
              Votações de Hoje — Câmara ({data!.camara.votacoes_hoje.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data!.camara.votacoes_hoje.map((v) => (
              <div key={v.id} className="p-2 rounded-lg border border-border flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{v.descricao || "Votação"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px]" style={{
                      backgroundColor: CAMARA_COLOR, color: "#fff", border: "none",
                    }}>{v.siglaOrgao}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(v.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                {v.aprovacao !== null && v.aprovacao !== undefined && (
                  <Badge variant={v.aprovacao === 1 ? "default" : "destructive"} className="text-[10px] shrink-0">
                    {v.aprovacao === 1 ? "Aprovada" : "Rejeitada"}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Câmara */}
      {(data?.camara.proximos.length || 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock size={14} style={{ color: CAMARA_COLOR }} />
              Próximos Eventos — Câmara
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data!.camara.proximos.map((e) => (
              <div key={e.id} className="p-2 rounded-lg border border-border">
                <p className="text-xs font-medium text-foreground">{e.descricao || e.titulo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {e.orgaos.map((o, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{o}</Badge>
                  ))}
                  {e.dataInicio && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.dataInicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Senado sessions */}
      {hasSenadoSessions && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText size={14} style={{ color: SENADO_COLOR }} />
              Sessões do Senado — Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data!.senado.sessoes_hoje.map((s, i) => (
              <div key={i} className="p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" style={{
                    backgroundColor: SENADO_COLOR, color: "#fff", border: "none",
                  }} className="text-[10px]">{s.tipo}</Badge>
                  <Badge variant="outline" className="text-[10px]">{s.situacao}</Badge>
                </div>
                {s.materias.length > 0 && (
                  <div className="space-y-1">
                    {s.materias.map((m, j) => (
                      <div key={j} className="text-xs text-foreground">
                        <span className="font-semibold">{m.sigla} {m.numero}/{m.ano}</span>
                        {m.ementa && <span className="text-muted-foreground"> — {m.ementa}</span>}
                        {m.resultado && <Badge variant="outline" className="ml-2 text-[10px]">{m.resultado}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!hasLiveEvents && !hasTodayVotes && !hasSenadoSessions && (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Clock size={40} className="mx-auto text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">
              Nenhuma sessão ou votação registrada para hoje
            </p>
            <p className="text-xs text-muted-foreground">
              As informações são atualizadas automaticamente a cada 3 minutos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
