import { UserCheck, UserMinus, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

interface ClassificationFilterProps {
  analises: Analise[];
  classFilter: string;
  onClassFilterChange: (v: string) => void;
}

const items = [
  { value: "all", label: "Todos", icon: Users, colorClass: "text-foreground" },
  { value: "Governo", label: "Governo", icon: UserCheck, colorClass: "text-governo" },
  { value: "Centro", label: "Centro", icon: UserMinus, colorClass: "text-centro" },
  { value: "Oposição", label: "Oposição", icon: UserX, colorClass: "text-oposicao" },
];

export function ClassificationFilter({
  analises,
  classFilter,
  onClassFilterChange,
}: ClassificationFilterProps) {
  const counts: Record<string, number> = { Governo: 0, Centro: 0, Oposição: 0 };
  analises.forEach((a) => {
    if (counts[a.classificacao] !== undefined) counts[a.classificacao]++;
  });

  return (
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
  );
}
