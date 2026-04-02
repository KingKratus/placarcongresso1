import { UserCheck, UserMinus, UserX, Users, HelpCircle, ArrowUpDown } from "lucide-react";
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
}

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const items = [
  { value: "all", label: "Todos", icon: Users, colorClass: "text-foreground" },
  { value: "Governo", label: "Governo", icon: UserCheck, colorClass: "text-governo" },
  { value: "Centro", label: "Centro", icon: UserMinus, colorClass: "text-centro" },
  { value: "Oposição", label: "Oposição", icon: UserX, colorClass: "text-oposicao" },
  { value: "Sem Dados", label: "Sem Dados", icon: HelpCircle, colorClass: "text-muted-foreground" },
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
}: ClassificationFilterProps) {
  const counts: Record<string, number> = { Governo: 0, Centro: 0, Oposição: 0, "Sem Dados": 0 };
  analises.forEach((a) => {
    if (counts[a.classificacao] !== undefined) counts[a.classificacao]++;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
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
              className={`gap-1.5 text-xs font-bold ${
                !isActive ? item.colorClass : ""
              }`}
            >
              <Icon size={14} />
              {item.label}
              <span
                className={`ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
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

      <div className="flex flex-wrap items-center gap-3">
        {onUfFilterChange && (
          <Select value={ufFilter} onValueChange={onUfFilterChange}>
            <SelectTrigger className="w-28 h-8 text-xs">
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
            <SelectTrigger className="w-36 h-8 text-xs">
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
            <SelectTrigger className="w-36 h-8 text-xs">
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
            <Label htmlFor="titulares" className="text-xs font-bold cursor-pointer">
              Titulares (Leg. 57)
            </Label>
          </div>
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
