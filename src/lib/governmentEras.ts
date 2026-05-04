export type Era = "Bolsonaro" | "Lula" | "Outro";

export const ERA_RANGES: Record<Exclude<Era, "Outro">, [number, number]> = {
  Bolsonaro: [2019, 2022],
  Lula: [2023, 2026],
};

export const ERA_COLORS: Record<Era, string> = {
  Bolsonaro: "hsl(45, 80%, 55%)",
  Lula: "hsl(0, 84%, 55%)",
  Outro: "hsl(var(--muted-foreground))",
};

export function eraDe(ano: number): Era {
  if (ano >= 2019 && ano <= 2022) return "Bolsonaro";
  if (ano >= 2023 && ano <= 2026) return "Lula";
  return "Outro";
}

export interface EraStat {
  era: Era;
  scoreAvg: number;
  parlamentares: number;
  totalVotos: number;
  classBreakdown: { Governo: number; Centro: number; Oposição: number };
  byYear: { ano: number; score: number; n: number }[];
}

/**
 * Aggregate per-era stats from analises rows (deputados or senadores merged).
 * Each row must expose: ano, score, total_votos, classificacao.
 */
export function statsByEra(rows: Array<{ ano: number; score: number | string; total_votos?: number | string; classificacao?: string | null }>): Record<Era, EraStat> {
  const init = (era: Era): EraStat => ({ era, scoreAvg: 0, parlamentares: 0, totalVotos: 0, classBreakdown: { Governo: 0, Centro: 0, Oposição: 0 }, byYear: [] });
  const buckets: Record<Era, EraStat> = { Bolsonaro: init("Bolsonaro"), Lula: init("Lula"), Outro: init("Outro") };
  const sumByEra: Record<Era, { sum: number; w: number }> = { Bolsonaro: { sum: 0, w: 0 }, Lula: { sum: 0, w: 0 }, Outro: { sum: 0, w: 0 } };
  const yearAgg: Record<number, { sum: number; w: number; n: number }> = {};

  rows.forEach((r) => {
    const era = eraDe(r.ano);
    const score = Number(r.score) || 0;
    const w = Number(r.total_votos) || 1;
    sumByEra[era].sum += score * w;
    sumByEra[era].w += w;
    buckets[era].parlamentares += 1;
    buckets[era].totalVotos += Number(r.total_votos) || 0;
    const cls = (r.classificacao || "Centro") as keyof EraStat["classBreakdown"];
    if (cls in buckets[era].classBreakdown) buckets[era].classBreakdown[cls] += 1;
    yearAgg[r.ano] = yearAgg[r.ano] || { sum: 0, w: 0, n: 0 };
    yearAgg[r.ano].sum += score * w;
    yearAgg[r.ano].w += w;
    yearAgg[r.ano].n += 1;
  });

  (Object.keys(buckets) as Era[]).forEach((era) => {
    const b = sumByEra[era];
    buckets[era].scoreAvg = b.w > 0 ? Math.round((b.sum / b.w) * 10) / 10 : 0;
  });
  buckets.Bolsonaro.byYear = Object.entries(yearAgg)
    .map(([ano, v]) => ({ ano: Number(ano), score: v.w > 0 ? Math.round((v.sum / v.w) * 10) / 10 : 0, n: v.n }))
    .filter((y) => eraDe(y.ano) === "Bolsonaro").sort((a, b) => a.ano - b.ano);
  buckets.Lula.byYear = Object.entries(yearAgg)
    .map(([ano, v]) => ({ ano: Number(ano), score: v.w > 0 ? Math.round((v.sum / v.w) * 10) / 10 : 0, n: v.n }))
    .filter((y) => eraDe(y.ano) === "Lula").sort((a, b) => a.ano - b.ano);

  return buckets;
}

export function deltaPct(after: number, before: number): { abs: number; rel: number | null } {
  const abs = Math.round((after - before) * 10) / 10;
  const rel = before > 0 ? Math.round(((after - before) / before) * 1000) / 10 : null;
  return { abs, rel };
}