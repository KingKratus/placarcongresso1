import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface Point {
  i: number;
  score: number;
  nome?: string | null;
  partido?: string | null;
}

export function LiveScoreChart({ points, height = 120 }: { points: Point[]; height?: number }) {
  if (points.length === 0) return null;
  const avg = points.reduce((a, p) => a + p.score, 0) / points.length;
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2">
      <div className="flex items-center justify-between mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Score ao vivo · {points.length} pts</span>
        <span className="tabular-nums">média {avg.toFixed(1)}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="i" tick={{ fontSize: 9 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
          <ReferenceLine y={avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 10,
              padding: "4px 8px",
            }}
            labelFormatter={(i) => `#${i}`}
            formatter={(value: number, _name, item: any) => [
              `${value.toFixed(1)} ${item?.payload?.nome ? `· ${item.payload.nome}` : ""}`,
              "Score",
            ]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 1.5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
