import { useEffect, useState } from "react";
import { Loader2, Calendar, Building2, FileText, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Evento {
  data: string | null;
  descricao: string;
  situacao: string | null;
  orgao: string | null;
  despacho: string | null;
}

interface Tramitacao {
  casa: "camara" | "senado";
  tipo: string;
  numero: string;
  ano: number;
  ementa: string | null;
  ultima_situacao: string | null;
  ultima_atualizacao: string | null;
  proposicao_id_externo: string | null;
  eventos: Evento[];
}

interface Props {
  casa: "camara" | "senado";
  tipo: string;
  numero: string;
  ano: number;
}

function statusVariant(situacao: string | null): { color: string; label: string } {
  if (!situacao) return { color: "bg-muted text-muted-foreground", label: "Sem status" };
  const s = situacao.toLowerCase();
  if (s.includes("aprovad") || s.includes("sancionad") || s.includes("promulgad") || s.includes("transformad"))
    return { color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300", label: situacao };
  if (s.includes("arquiv") || s.includes("rejeit") || s.includes("retirad"))
    return { color: "bg-rose-500/20 text-rose-700 dark:text-rose-300", label: situacao };
  if (s.includes("comiss") || s.includes("relator"))
    return { color: "bg-amber-500/20 text-amber-700 dark:text-amber-300", label: situacao };
  return { color: "bg-blue-500/20 text-blue-700 dark:text-blue-300", label: situacao };
}

export function TramitacaoTimeline({ casa, tipo, numero, ano }: Props) {
  const [data, setData] = useState<Tramitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-tramitacao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ casa, tipo, numero, ano, force }),
        },
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Erro ao buscar tramitação");
      setData(json.tramitacao);
    } catch (e: any) {
      setError(e.message || "Erro de conexão");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [casa, tipo, numero, ano]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin mr-2" size={18} />
        <span className="text-sm text-muted-foreground">Carregando tramitação…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center space-y-3">
        <AlertCircle className="mx-auto text-destructive" size={28} />
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => load(true)}>Tentar novamente</Button>
      </div>
    );
  }

  if (!data) return null;

  const { ementa, ultima_situacao, ultima_atualizacao, eventos, proposicao_id_externo } = data;
  const status = statusVariant(ultima_situacao);
  const externalUrl = casa === "camara"
    ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${proposicao_id_externo}`
    : `https://www25.senado.leg.br/web/atividade/materias/-/materia/${proposicao_id_externo}`;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-primary">{tipo} {numero}/{ano}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{casa === "camara" ? "Câmara" : "Senado"}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={refreshing} onClick={() => load(true)} title="Atualizar">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>
        {ementa && <p className="text-xs text-foreground line-clamp-3">{ementa}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge className={`text-[9px] px-1.5 py-0 border-0 ${status.color}`}>{status.label}</Badge>
          {ultima_atualizacao && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar size={10} />
              {new Date(ultima_atualizacao).toLocaleDateString("pt-BR")}
            </span>
          )}
          {proposicao_id_externo && (
            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 ml-auto">
              Ficha oficial <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
          {eventos.length} {eventos.length === 1 ? "evento" : "eventos"} de tramitação
        </p>
        {eventos.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 opacity-50" size={28} />
            Sem eventos de tramitação registrados.
          </div>
        ) : (
          <ScrollArea className="h-[60vh] pr-3">
            <ol className="relative border-l-2 border-border ml-2 space-y-3">
              {[...eventos].reverse().map((ev, i) => {
                const sv = statusVariant(ev.situacao);
                return (
                  <li key={i} className="ml-4 pb-1">
                    <div className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                    <div className="rounded-md border border-border bg-card/60 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                          <Calendar size={10} />
                          {ev.data ? new Date(ev.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </span>
                        {ev.orgao && (
                          <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                            <Building2 size={9} /> {ev.orgao}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground">{ev.descricao}</p>
                      {ev.despacho && ev.despacho !== ev.descricao && (
                        <p className="text-[10px] text-muted-foreground italic">{ev.despacho}</p>
                      )}
                      {ev.situacao && (
                        <Badge className={`text-[8px] px-1.5 py-0 border-0 ${sv.color}`}>
                          {ev.situacao}
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}