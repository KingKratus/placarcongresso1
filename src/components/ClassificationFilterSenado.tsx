import { UserCheck, UserMinus, UserX, Users, HelpCircle, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { BANCADA_OPTIONS } from "@/lib/bancadas";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_senadores">;

interface ClassificationFilterSenadoProps {
  analises: Analise[];
  classFilter: string;
  onClassFilterChange: (v: string) => void;
  ufFilter?: string;
  onUfFilterChange?: (v: string) => void;
  scoreRange?: [number, number];
  onScoreRangeChange?: (v: [number, number]) => void;
  sortBy?: string;
  onSortByChange?: (v: string) => void;
  bancadaFilter?: string;
  onBancadaFilterChange?: (v: string) => void;
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

export function ClassificationFilterSenado({
  analises,
  classFilter,
  onClassFilterChange,
  ufFilter = "all",
  onUfFilterChange,
  scoreRange,
  onScoreRangeChange,
  sortBy = "nome",
  onSortByChange,
  bancadaFilter = "all",
  onBancadaFilterChange,
}: ClassificationFilterSenadoProps) {
  const counts: Record<string, number> = { Governo: 0, Centro: 0, Oposição: 0, "Sem Dados": 0 };
  analises.forEach((a) => {
    if (counts[a.classificacao] !== undefined) counts[a.classificacao]++;
  });

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
      </div>

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
