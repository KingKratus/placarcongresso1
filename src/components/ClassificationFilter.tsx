import { useMemo } from "react";
import { UserCheck, UserMinus, UserX, Users, HelpCircle, ArrowUpDown, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BANCADA_OPTIONS } from "@/lib/bancadas";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface ClassificationFilterProps {
  analises: Analise[];
  classFilter: string;
  onClassFilterChange: (v: string) => void;
  ufFilter?: string;
  onUfFilterChange?: (v: string) => void;
  scoreRange?: [number, number];
  onScoreRangeChange?: (v: [number, number]) => void;
  sortBy?: string;
  onSortByChange?: (v: string) => void;
  titulares?: boolean;
  onTitularesChange?: (v: boolean) => void;
  bancadaFilter?: string;
  onBancadaFilterChange?: (v: string) => void;
  alignParty?: string;
  onAlignPartyChange?: (v: string) => void;
  alignParlamentar?: string;
  onAlignParlamentarChange?: (v: string) => void;
}

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const items = [
  { value: "all", label: "Todos", icon: Users, colorClass: "text-foreground" },
  { value: "Governo", label: "Gov", icon: UserCheck, colorClass: "text-governo" },
  { value: "Centro", label: "Centro", icon: UserMinus, colorClass: "text-centro" },
  { value: "Oposição", label: "Opos", icon: UserX, colorClass: "text-oposicao" },
  { value: "Sem Dados", label: "S/D", icon: HelpCircle, colorClass: "text-muted-foreground" },
];

export function ClassificationFilter({
  analises,
  classFilter,
  onClassFilterChange,
  ufFilter = "all",
  onUfFilterChange,
  scoreRange,
  onScoreRangeChange,
  sortBy = "nome",
  onSortByChange,
  titulares,
  onTitularesChange,
  bancadaFilter = "all",
  onBancadaFilterChange,
  alignParty = "all",
  onAlignPartyChange,
  alignParlamentar = "all",
  onAlignParlamentarChange,
}: ClassificationFilterProps) {
  const counts: Record<string, number> = { Governo: 0, Centro: 0, Oposição: 0, "Sem Dados": 0 };
  analises.forEach((a) => {
    if (counts[a.classificacao] !== undefined) counts[a.classificacao]++;
  });

  const partidos = useMemo(() => {
    const set = new Set<string>();
    analises.forEach(a => { if (a.deputado_partido) set.add(a.deputado_partido); });
    return [...set].sort();
  }, [analises]);

  const parlamentares = useMemo(() => {
    return analises
      .map(a => ({ id: a.deputado_id, nome: a.deputado_nome, partido: a.deputado_partido }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [analises]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const count = item.value === "all" ? analises.length : counts[item.value] || 0;
          const isActive = classFilter === item.value;

          return (
            <Button
              key={item.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onClassFilterChange(item.value)}
              className={`gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold px-2 sm:px-3 h-7 sm:h-8 ${
                !isActive ? item.colorClass : ""
              }`}
            >
              <Icon size={12} className="sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">{item.label}</span>
              <span
                className={`ml-0.5 sm:ml-1 text-[9px] sm:text-[10px] font-black px-1 sm:px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {onUfFilterChange && (
          <Select value={ufFilter} onValueChange={onUfFilterChange}>
            <SelectTrigger className="w-full sm:w-28 h-8 text-xs">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos UFs</SelectItem>
              {UFS.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {onBancadaFilterChange && (
          <Select value={bancadaFilter} onValueChange={onBancadaFilterChange}>
            <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
              <SelectValue placeholder="Bancada" />
            </SelectTrigger>
            <SelectContent>
              {BANCADA_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>{b === "all" ? "Todas Bancadas" : b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {onSortByChange && (
          <Select value={sortBy} onValueChange={onSortByChange}>
            <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
              <ArrowUpDown size={12} className="mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome A-Z</SelectItem>
              <SelectItem value="score-desc">Score ↓</SelectItem>
              <SelectItem value="score-asc">Score ↑</SelectItem>
              <SelectItem value="partido">Partido</SelectItem>
              <SelectItem value="uf">UF</SelectItem>
            </SelectContent>
          </Select>
        )}

        {onTitularesChange !== undefined && (
          <div className="flex items-center gap-2">
            <Switch
              id="titulares"
              checked={titulares}
              onCheckedChange={onTitularesChange}
            />
            <Label htmlFor="titulares" className="text-xs font-bold cursor-pointer whitespace-nowrap">
              Titulares (Leg. 57)
            </Label>
          </div>
        )}
      </div>

      {/* Alignment comparison filters */}
      {(onAlignPartyChange || onAlignParlamentarChange) && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase shrink-0">
            <GitCompareArrows size={12} /> Comparar:
          </div>
          {onAlignPartyChange && (
            <Select value={alignParty} onValueChange={onAlignPartyChange}>
              <SelectTrigger className="w-full sm:w-40 h-8 text-xs">
                <SelectValue placeholder="Alinhar c/ partido" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alinhamento Governo</SelectItem>
                {partidos.map((p) => (
                  <SelectItem key={p} value={p}>vs Média {p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onAlignParlamentarChange && (
            <Select value={alignParlamentar} onValueChange={onAlignParlamentarChange}>
              <SelectTrigger className="w-full sm:w-48 h-8 text-xs">
                <SelectValue placeholder="Alinhar c/ parlamentar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sem comparação</SelectItem>
                {parlamentares.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome} ({p.partido})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {onScoreRangeChange && scoreRange && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">
            Score: {scoreRange[0]}%–{scoreRange[1]}%
          </span>
          <Slider
            min={0}
            max={100}
            step={5}
            value={scoreRange}
            onValueChange={(v) => onScoreRangeChange(v as [number, number])}
            className="flex-1"
          />
        </div>
      )}
    </div>
  );
}
