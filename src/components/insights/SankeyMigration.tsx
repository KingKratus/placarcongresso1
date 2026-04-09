import { useMemo, useState, useEffect, useRef } from "react";

interface MigrationFlow {
  from: string;
  to: string;
  count: number;
}

interface Props {
  flows: MigrationFlow[];
  yearFrom: number;
  yearTo: number;
  casa: "camara" | "senado";
}

const CLASSES = ["Governo", "Centro", "Oposição", "Sem Dados"];
const CLASS_COLORS: Record<string, string> = {
  Governo: "hsl(160, 84%, 39%)",
  Centro: "hsl(239, 84%, 67%)",
  Oposição: "hsl(347, 77%, 50%)",
  "Sem Dados": "hsl(215, 16%, 47%)",
};
const FLOW_OPACITY = 0.25;
const FLOW_HOVER_OPACITY = 0.5;

const WIDTH = 600;
const HEIGHT = 320;
const NODE_W = 24;
const NODE_PAD = 16;
const LEFT_X = 60;
const RIGHT_X = WIDTH - 60 - NODE_W;

export function SankeyMigration({ flows, yearFrom, yearTo, casa }: Props) {
  const [animating, setAnimating] = useState(false);
  const prevKey = useRef(`${yearFrom}-${yearTo}`);

  // Trigger animation on year change
  useEffect(() => {
    const key = `${yearFrom}-${yearTo}`;
    if (key !== prevKey.current) {
      prevKey.current = key;
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 50);
      return () => clearTimeout(timer);
    }
  }, [yearFrom, yearTo]);

  const { leftNodes, rightNodes, links } = useMemo(() => {
    // Aggregate totals per class on each side
    const leftTotals: Record<string, number> = {};
    const rightTotals: Record<string, number> = {};

    flows.forEach((f) => {
      leftTotals[f.from] = (leftTotals[f.from] || 0) + f.count;
      rightTotals[f.to] = (rightTotals[f.to] || 0) + f.count;
    });

    const activeClasses = CLASSES.filter((c) => (leftTotals[c] || 0) > 0 || (rightTotals[c] || 0) > 0);
    if (activeClasses.length === 0) return { leftNodes: [], rightNodes: [], links: [] };

    const totalLeft = Object.values(leftTotals).reduce((a, b) => a + b, 0);
    const totalRight = Object.values(rightTotals).reduce((a, b) => a + b, 0);
    const maxTotal = Math.max(totalLeft, totalRight, 1);

    const usableH = HEIGHT - 40;

    // Build left nodes
    let yOff = 20;
    const lNodes = activeClasses
      .filter((c) => (leftTotals[c] || 0) > 0)
      .map((c) => {
        const h = Math.max(12, ((leftTotals[c] || 0) / maxTotal) * usableH);
        const node = { cls: c, x: LEFT_X, y: yOff, h, count: leftTotals[c] || 0 };
        yOff += h + NODE_PAD;
        return node;
      });

    // Build right nodes
    yOff = 20;
    const rNodes = activeClasses
      .filter((c) => (rightTotals[c] || 0) > 0)
      .map((c) => {
        const h = Math.max(12, ((rightTotals[c] || 0) / maxTotal) * usableH);
        const node = { cls: c, x: RIGHT_X, y: yOff, h, count: rightTotals[c] || 0 };
        yOff += h + NODE_PAD;
        return node;
      });

    // Build links
    // Track offset within each node
    const leftOffset: Record<string, number> = {};
    const rightOffset: Record<string, number> = {};
    lNodes.forEach((n) => { leftOffset[n.cls] = n.y; });
    rNodes.forEach((n) => { rightOffset[n.cls] = n.y; });

    const lnks = flows
      .filter((f) => f.count > 0)
      .sort((a, b) => {
        // Sort: same-class first, then by count
        if (a.from === a.to && b.from !== b.to) return -1;
        if (b.from === b.to && a.from !== a.to) return 1;
        return b.count - a.count;
      })
      .map((f) => {
        const lNode = lNodes.find((n) => n.cls === f.from);
        const rNode = rNodes.find((n) => n.cls === f.to);
        if (!lNode || !rNode) return null;

        const thickness = Math.max(2, (f.count / maxTotal) * usableH);
        const y0 = leftOffset[f.from];
        const y1 = rightOffset[f.to];
        leftOffset[f.from] += thickness;
        rightOffset[f.to] += thickness;

        // Determine color: use destination color for migrations, source for stays
        const color = f.from === f.to ? CLASS_COLORS[f.from] : CLASS_COLORS[f.to];

        return {
          from: f.from,
          to: f.to,
          count: f.count,
          y0,
          y1,
          thickness,
          color,
          isMigration: f.from !== f.to,
        };
      })
      .filter(Boolean) as any[];

    return { leftNodes: lNodes, rightNodes: rNodes, links: lnks };
  }, [flows]);

  if (leftNodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Sem dados de migração para exibir.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[600px] mx-auto"
        style={{
          minHeight: 200,
          opacity: animating ? 0 : 1,
          transform: animating ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
        }}
      >
        {/* Year labels */}
        <text x={LEFT_X + NODE_W / 2} y={14} textAnchor="middle" className="fill-muted-foreground text-[11px] font-bold">{yearFrom}</text>
        <text x={RIGHT_X + NODE_W / 2} y={14} textAnchor="middle" className="fill-muted-foreground text-[11px] font-bold">{yearTo}</text>

        {/* Flow paths */}
        {links.map((link: any, i: number) => {
          const x0 = LEFT_X + NODE_W;
          const x1 = RIGHT_X;
          const cx = (x0 + x1) / 2;
          const path = `
            M ${x0} ${link.y0}
            C ${cx} ${link.y0}, ${cx} ${link.y1}, ${x1} ${link.y1}
            L ${x1} ${link.y1 + link.thickness}
            C ${cx} ${link.y1 + link.thickness}, ${cx} ${link.y0 + link.thickness}, ${x0} ${link.y0 + link.thickness}
            Z
          `;
          return (
            <g key={i}>
              <path
                d={path}
                fill={link.color}
                opacity={FLOW_OPACITY}
                className="transition-all duration-500 hover:opacity-50"
                style={{ transition: "d 0.5s ease-out, opacity 0.5s ease-out" }}
              >
                <title>{`${link.from} → ${link.to}: ${link.count} ${casa === "camara" ? "deputados" : "senadores"}`}</title>
              </path>
              {/* Label on migration flows */}
              {link.isMigration && link.count >= 2 && (
                <text
                  x={(LEFT_X + NODE_W + RIGHT_X) / 2}
                  y={((link.y0 + link.y1) / 2) + link.thickness / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-[9px] font-bold pointer-events-none"
                  opacity={0.7}
                >
                  {link.count}
                </text>
              )}
            </g>
          );
        })}

        {/* Left nodes */}
        {leftNodes.map((node) => (
          <g key={`l-${node.cls}`}>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={node.h}
              rx={4}
              fill={CLASS_COLORS[node.cls]}
              opacity={0.85}
            />
            <text
              x={node.x - 6}
              y={node.y + node.h / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-foreground text-[10px] font-semibold"
            >
              {node.cls === "Oposição" ? "Opos." : node.cls === "Sem Dados" ? "S/D" : node.cls}
            </text>
            <text
              x={node.x - 6}
              y={node.y + node.h / 2 + 12}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              ({node.count})
            </text>
          </g>
        ))}

        {/* Right nodes */}
        {rightNodes.map((node) => (
          <g key={`r-${node.cls}`}>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={node.h}
              rx={4}
              fill={CLASS_COLORS[node.cls]}
              opacity={0.85}
            />
            <text
              x={node.x + NODE_W + 6}
              y={node.y + node.h / 2}
              textAnchor="start"
              dominantBaseline="middle"
              className="fill-foreground text-[10px] font-semibold"
            >
              {node.cls === "Oposição" ? "Opos." : node.cls === "Sem Dados" ? "S/D" : node.cls}
            </text>
            <text
              x={node.x + NODE_W + 6}
              y={node.y + node.h / 2 + 12}
              textAnchor="start"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              ({node.count})
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
