import { ChevronRight, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Deputado } from "@/hooks/useDeputados";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface DeputyCardProps {
  deputado: Deputado;
  analise?: Analise;
  onClick?: () => void;
  isFavorito?: boolean;
  onToggleFavorito?: (id: number) => void;
}

const classColors: Record<string, string> = {
  Governo: "border-governo/30 bg-governo/5",
  Centro: "border-centro/30 bg-centro/5",
  Oposição: "border-oposicao/30 bg-oposicao/5",
  "Sem Dados": "border-border",
};

const classTextColors: Record<string, string> = {
  Governo: "text-governo",
  Centro: "text-centro",
  Oposição: "text-oposicao",
  "Sem Dados": "text-muted-foreground",
};

const classBadgeColors: Record<string, string> = {
  Governo: "bg-governo",
  Centro: "bg-centro",
  Oposição: "bg-oposicao",
};

export function DeputyCard({ deputado, analise, onClick, isFavorito, onToggleFavorito }: DeputyCardProps) {
  return (
    <Card
      onClick={onClick}
      className={`p-4 border-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg group ${
        analise ? classColors[analise.classificacao] || "border-border" : "border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <img
            src={deputado.urlFoto}
            alt={deputado.nome}
            className="w-12 h-12 rounded-xl object-cover shadow-sm grayscale group-hover:grayscale-0 transition-all border-2 border-card"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://www.camara.leg.br/tema/assets/images/foto-deputado-ausente.png";
            }}
          />
          {analise && analise.classificacao !== "Sem Dados" && (
            <div
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg border-2 border-card flex items-center justify-center text-[9px] font-black text-primary-foreground shadow-md ${
                classBadgeColors[analise.classificacao] || "bg-muted"
              }`}
            >
              {Number(analise.score).toFixed(0)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-foreground truncate leading-tight">
            {deputado.nome}
          </h4>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              {deputado.siglaPartido}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              {deputado.siglaUf}
            </span>
            {analise && analise.is_titular === false && (
              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                Suplente
              </span>
            )}
            {analise?.situacao && analise.situacao !== "Exercício" && (
              <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {analise.situacao}
              </span>
            )}
          </div>
        </div>

        {onToggleFavorito && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorito(deputado.id); }}
            className="shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
            title={isFavorito ? "Remover favorito" : "Favoritar"}
          >
            <Heart
              size={16}
              className={isFavorito ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"}
            />
          </button>
        )}

        <ChevronRight
          size={18}
          className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
        />
      </div>

      {analise ? (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-black uppercase tracking-widest ${classTextColors[analise.classificacao]}`}>
              {analise.classificacao}
            </span>
            {analise.classificacao === "Sem Dados" && analise.situacao && (
              <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {analise.situacao === "Vacância" ? "Vago" : analise.situacao === "Suplência" ? "Não exerce" : analise.situacao === "Afastado" ? "Afastado" : analise.situacao === "Exercício" ? "Sem votações" : analise.situacao}
              </span>
            )}
          </div>
          <span className="text-[9px] font-medium text-muted-foreground">
            {analise.total_votos} votos úteis
          </span>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-border/50 text-center">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
            Aguardando análise...
          </span>
        </div>
      )}
    </Card>
  );
}
