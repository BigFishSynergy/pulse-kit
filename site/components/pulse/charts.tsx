"use client";
import { useEffect, useRef, useState } from "react";

// Small SVG charts, drawn the same way as the prototype. Colors come from the .rr CSS variables,
// so light and dark mode both work. Chart text stays 13px on screen however wide the chart is drawn.

type Fmt = (v: number | null | undefined) => string;

/** The font size, in chart units, that shows as 13px on screen at the chart's drawn width. */
function useTextSize(W: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [fs, setFs] = useState(13);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const w = el.getBoundingClientRect().width; if (w > 0) setFs((13 * W) / w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);
  return [ref, fs] as const;
}

/** Bars for a trend. The white bar is the latest full period; a dashed outline is a period still in progress.
 *  A red dashed line marks the average of the earlier full periods. `ly` draws last year's bars shaded behind. */
export function Bars({ vals, ly, labels, fmt, partialLast, unit, title }: {
  vals: number[]; ly?: number[]; labels: string[]; fmt: Fmt; partialLast: boolean; unit: string; title: string;
}) {
  const W = 300, pad = 4;
  const [ref, fs] = useTextSize(W);
  const H = Math.max(96, 80 + fs + 6), base = H - fs - 6;
  const max = Math.max(1, ...vals, ...(ly ?? []));
  const full = partialLast ? vals.slice(0, -1) : vals;
  const hiIdx = partialLast ? vals.length - 2 : vals.length - 1;
  const pool = full.slice(0, -1);
  const avg = pool.reduce((a, b) => a + b, 0) / Math.max(pool.length, 1);
  const bw = (W - pad * 2) / vals.length;
  const ay = base - (avg / max) * (base - 6);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} by ${unit}`}>
      {ly?.map((v, i) => {
        const h = (v / max) * (base - 6);
        return <rect key={"ly" + i} x={pad + i * bw + 0.5} y={base - h} width={bw - 1} height={Math.max(h, 0.5)} fill="var(--ly)"><title>{`${labels[i]} last year: ${fmt(v)}`}</title></rect>;
      })}
      {vals.map((v, i) => {
        const h = (v / max) * (base - 6);
        const partial = partialLast && i === vals.length - 1;
        const w = ly ? bw * 0.55 : bw - 3;
        const x = ly ? pad + i * bw + (bw - w) / 2 : pad + i * bw + 1.5;
        return (
          <rect key={i} x={x} y={base - h} width={w} height={Math.max(h, 0.5)}
            fill={partial ? "none" : i === hiIdx ? "var(--bar-hi)" : "var(--bar)"}
            stroke={partial ? "var(--bar-hi)" : undefined} strokeWidth={partial ? 1 : undefined} strokeDasharray={partial ? "2 2" : undefined}>
            <title>{`${labels[i]}${partial ? " so far" : ""}: ${fmt(v)}`}</title>
          </rect>
        );
      })}
      {pool.length ? <line x1={pad} x2={W - pad} y1={ay} y2={ay} stroke="var(--red)" strokeWidth={1.5} strokeDasharray="4 3" /> : null}
      <line x1={pad} x2={W - pad} y1={base} y2={base} stroke="var(--line-strong)" strokeWidth={1} />
      <text x={pad} y={H - 3} style={{ fontSize: fs }}>{labels[0]}</text>
      <text x={W - pad} y={H - 3} textAnchor="end" style={{ fontSize: fs }}>{labels[labels.length - 1]}{partialLast ? " so far" : ""}</text>
    </svg>
  );
}

export function barStats(vals: number[], partialLast: boolean) {
  const full = partialLast ? vals.slice(0, -1) : vals;
  const hiIdx = partialLast ? vals.length - 2 : vals.length - 1;
  const pool = full.slice(0, -1);
  return { hi: vals[hiIdx], hiIdx, avg: pool.reduce((a, b) => a + b, 0) / Math.max(pool.length, 1), partial: partialLast ? vals[vals.length - 1] : null, n: pool.length };
}

export type YearSeries = { series: Record<number, [number, number][]>; xMax: number; ticks: { x: number; label: string }[]; quarter?: number };

// Older years each get their own gray and dash pattern, newest lightest, so every line can be told apart and matched to its button.
const OLD: { stroke: string; strokeDasharray?: string }[] = [
  { stroke: "var(--yr1)" },
  { stroke: "var(--yr2)", strokeDasharray: "8 4" },
  { stroke: "var(--yr3)", strokeDasharray: "2 3" },
  { stroke: "var(--yr4)", strokeDasharray: "10 3 2 3" },
  { stroke: "var(--yr5)", strokeDasharray: "4 4" },
];

/** How a year's line is drawn. `years` is every year in the chart, shown or hidden, so a year keeps its look when others are toggled. */
export function yearLine(y: number, curYear: number, lastYear: number, years: number[]) {
  if (y === curYear) return { stroke: "var(--bar-hi)", strokeWidth: 3 };
  if (y === lastYear) return { stroke: "var(--red)", strokeWidth: 2, strokeDasharray: "6 4" };
  const older = years.filter((x) => x !== curYear && x !== lastYear).sort((a, b) => b - a);
  return { ...OLD[Math.min(Math.max(older.indexOf(y), 0), OLD.length - 1)], strokeWidth: 2 };
}

/** The legend sample for one year, drawn exactly like its line. */
export function YearSwatch({ y, curYear, lastYear, years }: { y: number; curYear: number; lastYear: number; years: number[] }) {
  const st = yearLine(y, curYear, lastYear, years);
  return <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden><line x1="1" x2="23" y1="4" y2="4" {...st} strokeWidth={Math.min(st.strokeWidth, 2.5)} /></svg>;
}

/** One line per year: this year thick white, last year red dashed, each older year its own gray. */
export function LineChart({ data, fmt, curYear, lastYear, hidden, cutX }: {
  data: YearSeries; fmt: Fmt; curYear: number; lastYear: number; hidden: Set<number>; cutX: number | null;
}) {
  const W = 640, H = 260, L = 8, R = 8;
  const [ref, fs] = useTextSize(W);
  const T = Math.max(12, fs + 4), base = H - Math.max(24, fs + 10);
  const allYears = Object.keys(data.series).map(Number);
  const ys = allYears.filter((y) => !hidden.has(y));
  const max = Math.max(1, ...ys.flatMap((y) => data.series[y].map((p) => p[1])));
  const X = (x: number) => L + ((x - 1) / Math.max(data.xMax - 1, 1)) * (W - L - R);
  const Y = (v: number) => base - (v / max) * (base - T);
  const order = ys.sort((a, b) => Number(a === curYear) - Number(b === curYear) || Number(a === lastYear) - Number(b === lastYear) || a - b);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Comparison by year">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={Y(max * f)} y2={Y(max * f)} stroke="var(--line)" />
          <text x={W - R} y={Y(max * f) - 3} textAnchor="end" style={{ fontSize: fs }}>{fmt(max * f)}</text>
        </g>
      ))}
      {cutX ? <line x1={X(cutX)} x2={X(cutX)} y1={T} y2={base} stroke="var(--red)" strokeWidth={1.5} /> : null}
      {order.map((y) => {
        const pts = data.series[y];
        if (!pts.length) return null;
        const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
        const st = yearLine(y, curYear, lastYear, allYears);
        const lp = pts[pts.length - 1];
        return (
          <g key={y}>
            <path d={d} fill="none" {...st}><title>{String(y)}</title></path>
            {y === curYear ? <circle cx={X(lp[0])} cy={Y(lp[1])} r={4.5} fill="var(--bar-hi)" /> : null}
          </g>
        );
      })}
      <line x1={L} x2={W - R} y1={base} y2={base} stroke="var(--line-strong)" />
      {data.ticks.map((t, i) => (
        <text key={i} x={X(t.x)} y={H - 6} textAnchor={i === 0 ? "start" : "middle"} style={{ fontSize: fs }}>{t.label}</text>
      ))}
    </svg>
  );
}
