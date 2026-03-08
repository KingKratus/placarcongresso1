import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Senador } from "@/hooks/useSenadores";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_senadores">;

interface SenadorCardProps {
  senador: Senador;
  analise?: Analise;
  onClick?: () => void;
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

export function SenadorCard({ senador, analise, onClick }: SenadorCardProps) {
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
            src={senador.urlFoto}
            alt={senador.nome}
            className="w-12 h-12 rounded-xl object-cover shadow-sm grayscale group-hover:grayscale-0 transition-all border-2 border-card"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador-sem-foto.png";
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
            {senador.nome}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              {senador.siglaPartido}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              {senador.siglaUf}
            </span>
          </div>
        </div>

        <ChevronRight
          size={18}
          className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
        />
      </div>

      {analise ? (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <span
            className={`text-[10px] font-black uppercase tracking-widest ${
              classTextColors[analise.classificacao]
            }`}
          >
            {analise.classificacao}
          </span>
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
