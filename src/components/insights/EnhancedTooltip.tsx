import React from "react";

interface TooltipRow {
  label: string;
  value: string | number;
  color?: string;
}

interface EnhancedTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  rows?: (payload: any[], label: string) => TooltipRow[];
}

export function EnhancedTooltip({ active, payload, label, rows }: EnhancedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const displayRows = rows ? rows(payload, String(label ?? "")) : payload.map((p) => ({
    label: p.name || p.dataKey,
    value: p.value,
    color: p.color || p.fill || p.stroke,
  }));

  return (
    <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs space-y-1">
      {label !== undefined && (
        <p className="font-semibold text-foreground border-b border-border/40 pb-1 mb-1">{label}</p>
      )}
      {displayRows.map((row, i) => (
        <div key={i} className="flex items-center gap-2 justify-between min-w-[140px]">
          <span className="flex items-center gap-1.5">
            {row.color && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: row.color }} />}
            <span className="text-muted-foreground">{row.label}</span>
          </span>
          <span className="font-semibold text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// Tooltip builder for Pie charts (classification distribution)
export function pieTooltipRows(casa: string) {
  return (payload: any[]) => {
    const entry = payload[0];
    if (!entry) return [];
    const total = entry.payload?.payload
      ? undefined
      : undefined;
    return [
      { label: entry.name, value: `${entry.value} ${casa}`, color: entry.payload?.fill },
    ];
  };
}

// Tooltip builder for Top/Bottom bar charts
export function topBottomTooltipRows(payload: any[]) {
  const entry = payload[0];
  if (!entry) return [];
  const d = entry.payload;
  return [
    { label: "Score", value: `${d.score}%`, color: entry.payload?.fill || entry.color },
    { label: "Casa", value: d.casa },
    ...(d.partido ? [{ label: "Partido", value: d.partido }] : []),
  ];
}

// Tooltip builder for histogram
export function histogramTooltipRows(totalDep: number, totalSen: number) {
  return (payload: any[], label: string): TooltipRow[] => {
    return payload.map((p) => {
      const total = p.dataKey === "camara" ? totalDep : totalSen;
      const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
      return {
        label: p.name,
        value: `${p.value} (${pct}%)`,
        color: p.fill || p.color,
      };
    });
  };
}

// Tooltip for party comparison
export function partyTooltipRows(payload: any[]): TooltipRow[] {
  return payload.map((p) => ({
    label: p.name,
    value: `${p.value}%`,
    color: p.fill || p.color,
  }));
}

// Tooltip for volume line chart
export function volumeTooltipRows(payload: any[]): TooltipRow[] {
  return payload.map((p) => ({
    label: p.name,
    value: `${p.value} votações`,
    color: p.stroke || p.color,
  }));
}
