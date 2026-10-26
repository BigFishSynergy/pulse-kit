"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { aggregate, add, metric, METRICS, zero, type Facts, type GroupBy, type MetricDef, type Totals } from "@/lib/pulse/ledger";
import { dfmt, MON, money, moneyK, n0, pct } from "@/lib/pulse/format";
import { Seg } from "./ui";
import GraphicMaker from "./GraphicMaker";

// Build any report: pick dates (presets, rolling windows or custom), check the measures, group it any way,
// filter to reps or channels, and show it as tiles, a table, ranked bars, trend lines, a heat grid, a podium
// or an animated race. Numbers come from the ledger, which the data job proves equal to the rules' pulse_metrics.

export type View = "tiles" | "table" | "bars" | "lines" | "heat" | "podium" | "race";
export type State = {
  preset: string; start: string; end: string; compare: "none" | "prev" | "ly";
  metrics: string[]; by: GroupBy; by2: GroupBy; view: View;
  who: "company" | "team" | "pick"; reps: string[]; srcs: string[]; closeTeam: boolean;
};

const NEON = "#39FF14", RED = "#D22B2B";
// Chart text styles live inside each SVG so a downloaded image looks the same as the screen.
const SVG_STYLE = `.t-lab{font:600 13px Inter,Arial,sans-serif;fill:#D4D4D4}.t-val{font:700 15px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;fill:#D4D4D4;letter-spacing:.04em}.t-val.hi{fill:#39FF14}.t-ax{font:11px Inter,Arial,sans-serif;fill:#8C8C8C}.t-cell{font:600 11px Inter,Arial,sans-serif}.t-place{font:900 54px 'Barlow Condensed','Arial Narrow',Arial,sans-serif}.t-name{font:800 22px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;fill:#FFFFFF;letter-spacing:.04em}.t-big{font:900 36px 'Barlow Condensed','Arial Narrow',Arial,sans-serif}.t-race{font:900 44px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;fill:#3A3A3A;letter-spacing:.04em}`;
const Style = () => <style>{SVG_STYLE}</style>;
const SERIES = [NEON, "#FFFFFF", RED, "#A8A8A8", "#6E6E6E", "#4A4A4A"];
export const PRESETS: [string, string][] = [
  ["this_week", "This week"], ["last_week", "Last week"], ["mtd", "Month to date"], ["last_month", "Last month"],
  ["qtd", "Quarter to date"], ["last_quarter", "Last quarter"], ["ytd", "Year to date"], ["last_year", "Last year"],
  ["r7", "Rolling 7"], ["r30", "Rolling 30"], ["r60", "Rolling 60"], ["r90", "Rolling 90"], ["r180", "Rolling 180"], ["r365", "Rolling 365"],
  ["all", "All time"], ["custom", "Custom dates"],
];
export const GROUPS: [GroupBy, string][] = [
  ["none", "Total"], ["rep", "Rep"], ["src", "Lead channel"], ["sub", "Sub source"], ["town", "Town"], ["county", "County"], ["csr", "Setter (CSR)"],
  ["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"], ["dow", "Day of week"],
];
export const TIME: GroupBy[] = ["week", "month", "quarter", "year", "dow"];
export const VIEWS: [View, string][] = [["tiles", "Tiles"], ["table", "Table"], ["bars", "Bars"], ["lines", "Lines"], ["heat", "Heat grid"], ["podium", "Podium"], ["race", "Race"]];

// ---------- dates ----------
const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (s: string) => new Date(s + "T00:00:00Z");
const addDays = (s: string, n: number) => iso(new Date(D(s).getTime() + n * 864e5));
const addYears = (s: string, n: number) => { const d = D(s); d.setUTCFullYear(d.getUTCFullYear() + n); return iso(d); };
export function presetRange(p: string, asOf: string, epoch: string): [string, string] {
  const t = D(asOf), y = t.getUTCFullYear(), m = t.getUTCMonth(), dow = (t.getUTCDay() + 6) % 7;
  const qm = Math.floor(m / 3) * 3;
  switch (p) {
    case "this_week": return [addDays(asOf, -dow), asOf];
    case "last_week": return [addDays(asOf, -dow - 7), addDays(asOf, -dow - 1)];
    case "mtd": return [iso(new Date(Date.UTC(y, m, 1))), asOf];
    case "last_month": return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
    case "qtd": return [iso(new Date(Date.UTC(y, qm, 1))), asOf];
    case "last_quarter": return [iso(new Date(Date.UTC(y, qm - 3, 1))), iso(new Date(Date.UTC(y, qm, 0)))];
    case "ytd": return [`${y}-01-01`, asOf];
    case "last_year": return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case "all": return [epoch, asOf];
    default: {
      const n = /^r(\d+)$/.exec(p);
      // The rules' rolling windows: start = end minus N days, both days counted
      return n ? [addDays(asOf, -Number(n[1])), asOf] : [addDays(asOf, -30), asOf];
    }
  }
}
export function compareRange(start: string, end: string, how: State["compare"]): [string, string] | null {
  if (how === "ly") return [addYears(start, -1), addYears(end, -1)];
  if (how === "prev") { const len = (D(end).getTime() - D(start).getTime()) / 864e5 + 1; return [addDays(start, -len), addDays(start, -1)]; }
  return null;
}

// ---------- formatting ----------
function fmt(m: MetricDef, t: Totals | undefined, short = false) {
  if (!t) return "–";
  const v = m.value(t);
  if (v == null) return "–";
  if (m.kind === "money") return short ? moneyK(v) : money(v);
  if (m.kind === "rate") return pct(v, short ? 0 : 1);
  return n0(v);
}
const counts = (m: MetricDef, t?: Totals) => (t && m.n && m.d && m.d(t) ? ` (${n0(m.n(t))} of ${n0(m.d(t))})` : "");
function change(m: MetricDef, a?: Totals, b?: Totals) {
  const x = a ? m.value(a) : null, y = b ? m.value(b) : null;
  if (x == null || y == null) return null;
  if (m.kind === "rate") return { txt: `${x - y >= 0 ? "+" : ""}${((x - y) * 100).toFixed(1)} pts`, up: x >= y };
  if (!y) return x ? { txt: "New", up: true } : null;
  const c = (x - y) / y;
  return { txt: `${c >= 0 ? "+" : ""}${pct(c, 0)}`, up: c >= 0 };
}
// Change against the comparison period, in plain gray: a report has no goal to color it by.
const Chip = ({ c }: { c: ReturnType<typeof change> }) => (c ? <span className="chg">{c.txt}</span> : <span className="sub">–</span>);
function label(by: GroupBy, k: string) {
  if (by === "month") return `${MON[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`;
  if (by === "week") return dfmt(k);
  return k;
}

// ---------- state in the address bar, so any report can be bookmarked or shared ----------
export const DEFAULT: State = { preset: "qtd", start: "", end: "", compare: "ly", metrics: ["sales", "jobs", "close", "ticket"], by: "rep", by2: "month", view: "table", who: "team", reps: [], srcs: [], closeTeam: true };
/** The address-bar hash that opens the report builder on a given report. */
export const reportHash = (st: State) => "#" + btoa(encodeURIComponent(JSON.stringify(st)));
function readHash(): Partial<State> {
  try { return JSON.parse(decodeURIComponent(atob(location.hash.slice(1)))); } catch { return {}; }
}

export default function ReportBuilder({ asOf, rep, repName, canGraphic }: { asOf: string; rep?: string; repName?: string; canGraphic?: boolean }) {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [err, setErr] = useState("");
  const [st, setSt] = useState<State>(rep ? { ...DEFAULT, by: "src", metrics: ["sales", "jobs", "close", "ticket"] } : DEFAULT);
  const svgRef = useRef<HTMLDivElement>(null);

  const hashRead = useRef(false);
  useEffect(() => {
    // read the report from the address bar once, before this component ever writes its own state back there
    if (!hashRead.current) {
      hashRead.current = true;
      const h = readHash();
      if (Object.keys(h).length) setSt((s) => ({ ...s, ...h }));
    }
    fetch(`/pulse/api/facts${rep ? `?rep=${rep}` : ""}`).then(async (r) => (r.ok ? setFacts(await r.json()) : setErr((await r.json()).error || "Could not load the data."))).catch(() => setErr("Could not load the data."));
  }, [rep]);
  useEffect(() => {
    try { history.replaceState(null, "", "#" + btoa(encodeURIComponent(JSON.stringify(st)))); } catch {}
  }, [st]);
  const set = (p: Partial<State>) => setSt((s) => ({ ...s, ...p }));

  const [start, end] = st.preset === "custom" && st.start && st.end ? [st.start, st.end] : presetRange(st.preset, asOf, facts?.epoch ?? "2015-01-01");
  const cmp = compareRange(start, end, st.compare);
  const filters = useMemo(() => ({
    reps: st.who === "pick" && st.reps.length ? new Set(st.reps) : null,
    teamOnly: st.who === "team",
    srcs: st.srcs.length ? new Set(st.srcs) : null,
    closeTeam: st.closeTeam,
  }), [st.who, st.reps, st.srcs, st.closeTeam]);
  const ms = st.metrics.map(metric);
  const m0 = ms[0] ?? METRICS[0];
  const by2 = TIME.includes(st.by2) && st.by2 !== st.by ? st.by2 : st.by === "month" ? "week" : "month";

  const cur = useMemo(() => (facts ? aggregate(facts, start, end, filters, st.by) : null), [facts, start, end, filters, st.by]);
  const prev = useMemo(() => (facts && cmp ? aggregate(facts, cmp[0], cmp[1], filters, st.by) : null), [facts, cmp?.[0], cmp?.[1], filters, st.by]); // eslint-disable-line react-hooks/exhaustive-deps
  const grid = useMemo(() => (facts && ["heat", "lines", "race", "tiles"].includes(st.view) ? aggregate(facts, start, end, filters, st.view === "tiles" ? "none" : st.by, st.view === "tiles" ? "week" : by2) : null), [facts, start, end, filters, st.by, by2, st.view]);

  if (err) return <div className="state"><h2>No report data yet</h2><p className="sub">{err}</p></div>;
  if (!facts || !cur) return <div className="state"><h2>Loading the report builder</h2><p className="sub">Pulling every lead, sit, sale and install so you can slice them any way you like.</p></div>;

  const totalOf = (g: Map<string, Map<string, Totals>> | null, k: string) => g?.get(k)?.get("All");
  // rows where every checked measure is empty or zero only add noise
  let rows = [...cur.keys()].map((k) => ({ k, t: totalOf(cur, k)!, p: totalOf(prev, k) })).filter((r) => ms.some((m) => (m.value(r.t) ?? 0) !== 0));
  const sortVal = (t?: Totals) => (t ? m0.value(t) ?? -Infinity : -Infinity);
  if (TIME.includes(st.by)) rows.sort((a, b) => (st.by === "dow" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(a.k) - ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(b.k) : a.k.localeCompare(b.k)));
  else rows.sort((a, b) => sortVal(b.t) - sortVal(a.t));
  const all = rows.reduce((t, r) => add(t, r.t), zero());
  const allPrev = prev ? [...prev.keys()].reduce((t, k) => add(t, totalOf(prev, k)!), zero()) : undefined;
  const ranked = TIME.includes(st.by) ? rows : rows.filter((r) => m0.value(r.t) != null);

  const dims = facts.dims;
  const repOpts = rep ? [] : dims.rep.filter((r) => r !== "(no rep)");
  const srcOpts = dims.src;

  // ---------- exports ----------
  const csv = () => {
    const head = ["Group", ...ms.flatMap((m) => (cmp ? [m.label, `${m.label} (compare)`] : [m.label]))];
    const lines = [head, ...rows.map((r) => [label(st.by, r.k), ...ms.flatMap((m) => (cmp ? [String(m.value(r.t) ?? ""), String(r.p ? m.value(r.p) ?? "" : "")] : [String(m.value(r.t) ?? "")]))])];
    const blob = new Blob([lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pulse-report-${start}-to-${end}.csv`;
    a.click();
  };
  const png = () => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const vb = svg.viewBox.baseVal, scale = 2;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = vb.width * scale; c.height = vb.height * scale;
      const x = c.getContext("2d")!;
      x.fillStyle = "#0A0A0A"; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = `pulse-${st.view}-${start}-to-${end}.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  };

  const title = `${ms.map((m) => m.label).join(", ")}${st.by !== "none" ? ` by ${GROUPS.find((g) => g[0] === st.by)?.[1].toLowerCase()}` : ""}`;
  const sub = `${dfmt(start)} ${start.slice(0, 4)} to ${dfmt(end)} ${end.slice(0, 4)}${cmp ? ` · vs ${dfmt(cmp[0])} ${cmp[0].slice(0, 4)} to ${dfmt(cmp[1])} ${cmp[1].slice(0, 4)}` : ""}${rep && repName ? ` · ${repName}` : ""}`;

  return (
    <div className="rb">
      <section className="rb-controls">
        <div className="rb-row">
          <label className="rb-field"><span className="label">Dates</span>
            <select value={st.preset} onChange={(e) => set({ preset: e.target.value, start: st.start || start, end: st.end || end })}>
              {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {st.preset === "custom" ? (
            <>
              <label className="rb-field"><span className="label">From</span><input type="date" value={st.start || start} max={asOf} onChange={(e) => set({ start: e.target.value })} /></label>
              <label className="rb-field"><span className="label">To</span><input type="date" value={st.end || end} max={asOf} onChange={(e) => set({ end: e.target.value })} /></label>
            </>
          ) : null}
          <div className="rb-field"><span className="label">Compare to</span><Seg label="Compare" value={st.compare} options={[["none", "Nothing"], ["prev", "Period before"], ["ly", "Same dates last year"]]} onChange={(v) => set({ compare: v as State["compare"] })} /></div>
        </div>
        <div className="rb-field"><span className="label">Measures <span className="sub">(the first one ranks and colors the charts)</span></span>
          <div className="checks">
            {METRICS.map((m) => {
              const on = st.metrics.includes(m.key);
              return (
                <label key={m.key} className={`check ${on ? "on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => set({ metrics: on ? st.metrics.filter((x) => x !== m.key) : [...st.metrics, m.key] })} />
                  {m.label}
                </label>
              );
            })}
          </div>
        </div>
        <div className="rb-row">
          <label className="rb-field"><span className="label">Group by</span>
            <select value={st.by} onChange={(e) => set({ by: e.target.value as GroupBy })}>
              {GROUPS.filter(([k]) => !(rep && k === "rep")).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {["heat", "lines", "race"].includes(st.view) ? (
            <label className="rb-field"><span className="label">Over time by</span>
              <select value={by2} onChange={(e) => set({ by2: e.target.value as GroupBy })}>
                {GROUPS.filter(([k]) => TIME.includes(k) && k !== st.by).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          ) : null}
          {!rep ? (
            <div className="rb-field"><span className="label">Who</span><Seg label="Who" value={st.who} options={[["company", "Whole company"], ["team", "Sales team"], ["pick", "Pick reps"]]} onChange={(v) => set({ who: v as State["who"] })} /></div>
          ) : null}
          <div className="rb-field"><span className="label">Close rate counts</span><Seg label="Close rate" value={st.closeTeam ? "team" : "company"} options={[["team", "Sales team sits"], ["company", "Every quoted sit"]]} onChange={(v) => set({ closeTeam: v === "team" })} /></div>
        </div>
        {st.who === "pick" && !rep ? (
          <div className="checks">{repOpts.map((r) => { const on = st.reps.includes(r); return <label key={r} className={`check ${on ? "on" : ""}`}><input type="checkbox" checked={on} onChange={() => set({ reps: on ? st.reps.filter((x) => x !== r) : [...st.reps, r] })} />{r}</label>; })}</div>
        ) : null}
        <details className="rb-more"><summary>Lead channels {st.srcs.length ? <span className="c">{st.srcs.length} picked</span> : <span className="c">all</span>}</summary>
          <div className="checks">{srcOpts.map((s) => { const on = st.srcs.includes(s); return <label key={s} className={`check ${on ? "on" : ""}`}><input type="checkbox" checked={on} onChange={() => set({ srcs: on ? st.srcs.filter((x) => x !== s) : [...st.srcs, s] })} />{s}</label>; })}</div>
        </details>
      </section>

      <section>
        <div className="sechead">
          <h2>{title || "Pick a measure"} <small>{sub}</small></h2>
          <div className="seg-row">
            <Seg label="Show as" value={st.view} options={VIEWS} onChange={(v) => set({ view: v as View })} />
            <button type="button" className="btn" onClick={csv}>CSV</button>
            {["bars", "lines", "heat", "podium", "race"].includes(st.view) ? <button type="button" className="btn" onClick={png}>Image</button> : null}
          </div>
        </div>
        {!ms.length ? <div className="empty-note">Check at least one measure above.</div> : (
          <div ref={svgRef} className="rb-out">
            {st.view === "tiles" ? <Tiles ms={ms} all={all} prev={allPrev} weeks={grid?.get("All")} /> : null}
            {st.view === "table" ? <Table ms={ms} rows={rows} by={st.by} all={all} prev={allPrev} cmp={!!cmp} /> : null}
            {st.view === "bars" ? <BarsView m={m0} rows={ranked.slice(0, 25)} by={st.by} cmp={!!cmp} /> : null}
            {st.view === "lines" ? <Lines m={m0} grid={grid} by={st.by} by2={by2} order={ranked.map((r) => r.k)} /> : null}
            {st.view === "heat" ? <Heat m={m0} grid={grid} by={st.by} by2={by2} order={ranked.map((r) => r.k)} /> : null}
            {st.view === "podium" ? <Podium m={m0} rows={ranked} by={st.by} /> : null}
            {st.view === "race" ? <Race m={m0} grid={grid} by={st.by} by2={by2} /> : null}
          </div>
        )}
        {canGraphic && ms.length ? (
          <GraphicMaker scope={rep ? "rep" : "lead"} report={{
            title, sub,
            columns: [GROUPS.find((g) => g[0] === st.by)?.[1] ?? "Group", ...ms.flatMap((m) => (cmp ? [m.label, `${m.label} (compare)`] : [m.label]))],
            rows: rows.slice(0, 25).map((r) => [label(st.by, r.k), ...ms.flatMap((m) => (cmp ? [fmt(m, r.t) + counts(m, r.t), fmt(m, r.p)] : [fmt(m, r.t) + counts(m, r.t)]))]),
          }} />
        ) : null}
        <p className="explain">Every number follows the company&apos;s rules: each measure counts on its own date (leads by lead date, sits by appointment date, sales by approved date, revenue by install date). Rates are totals divided by totals. Close rate is demos signed in the dates divided by demos held in them; demo conversion is demos held in the dates that ever signed, the fairer way to compare sources, towns and setters. Both count {st.closeTeam ? "sales team demos (the rules' default)" : "every quoted demo, company-wide"}. The address bar holds this exact report, so you can bookmark it or send the link.</p>
      </section>
    </div>
  );
}

// ---------- views ----------
function Tiles({ ms, all, prev, weeks }: { ms: MetricDef[]; all: Totals; prev?: Totals; weeks?: Map<string, Totals> }) {
  const wk = weeks ? [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])) : [];
  return (
    <div className="strip rb-tiles">
      {ms.map((m) => {
        const vals = wk.map(([, t]) => m.value(t) ?? 0);
        const max = Math.max(1e-9, ...vals);
        const pts = vals.map((v, i) => `${(i / Math.max(vals.length - 1, 1)) * 100},${30 - (v / max) * 28}`).join(" ");
        return (
          <div key={m.key}>
            <span className="label">{m.label}</span>
            <span className="big num">{fmt(m, all)}</span>
            <span className="sub">{counts(m, all)}</span>
            {prev ? <span className="sub"><Chip c={change(m, all, prev)} /> vs {fmt(m, prev)}</span> : null}
            {vals.length > 1 ? <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="spark"><polyline points={pts} fill="none" stroke={NEON} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg> : null}
          </div>
        );
      })}
    </div>
  );
}

function Table({ ms, rows, by, all, prev, cmp }: { ms: MetricDef[]; rows: { k: string; t: Totals; p?: Totals }[]; by: GroupBy; all: Totals; prev?: Totals; cmp: boolean }) {
  const [sortK, setSortK] = useState<string | null>(null);
  const [dir, setDir] = useState(-1);
  const sorted = sortK ? rows.slice().sort((a, b) => dir * ((metric(sortK).value(a.t) ?? -Infinity) - (metric(sortK).value(b.t) ?? -Infinity))) : rows;
  return (
    <div className="tbl"><table>
      <thead><tr><th>{GROUPS.find((g) => g[0] === by)?.[1]}</th>{ms.map((m) => (
        <th key={m.key} className="r"><button type="button" className="sortbtn" onClick={() => { setDir(sortK === m.key ? -dir : -1); setSortK(m.key); }}>{m.label}{sortK === m.key ? (dir < 0 ? " ▼" : " ▲") : ""}</button></th>
      ))}</tr></thead>
      <tbody>
        {sorted.slice(0, 200).map((r, i) => (
          <tr key={r.k}>
            <td className="m">{!TIME.includes(by) && by !== "none" ? <span className="rank">{i + 1}</span> : null}{label(by, r.k)}</td>
            {ms.map((m) => <td key={m.key} className="r num">{fmt(m, r.t)}<span className="sub">{counts(m, r.t)}</span>{cmp ? <div><Chip c={change(m, r.t, r.p)} /></div> : null}</td>)}
          </tr>
        ))}
        {by !== "none" ? (
          <tr className="total"><td className="m">All</td>{ms.map((m) => <td key={m.key} className="r num">{fmt(m, all)}<span className="sub">{counts(m, all)}</span>{cmp ? <div><Chip c={change(m, all, prev)} /></div> : null}</td>)}</tr>
        ) : null}
      </tbody>
    </table></div>
  );
}

function BarsView({ m, rows, by, cmp }: { m: MetricDef; rows: { k: string; t: Totals; p?: Totals }[]; by: GroupBy; cmp: boolean }) {
  const W = 900, rowH = 30, L = 190, R = 110, H = Math.max(rows.length, 1) * rowH + 16;
  const max = Math.max(1e-9, ...rows.flatMap((r) => [m.value(r.t) ?? 0, cmp && r.p ? m.value(r.p) ?? 0 : 0]));
  const X = (v: number) => (v / max) * (W - L - R);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} ranked`} className="rb-svg">
      <Style />
      {rows.map((r, i) => {
        const v = m.value(r.t) ?? 0, p = cmp && r.p ? m.value(r.p) ?? 0 : null, y = 8 + i * rowH;
        const top = i === 0 && !TIME.includes(by);
        return (
          <g key={r.k}>
            <text x={L - 10} y={y + 18} textAnchor="end" className="t-lab">{label(by, r.k).slice(0, 26)}</text>
            {p != null ? <rect x={L} y={y + 4} width={X(p)} height={rowH - 8} fill="#262626" /> : null}
            <rect x={L} y={y + (p != null ? 9 : 4)} width={Math.max(X(v), 1)} height={p != null ? rowH - 18 : rowH - 8} fill={top ? NEON : "#8C8C8C"} />
            <text x={L + Math.max(X(v), 1) + 8} y={y + 18} className={top ? "t-val hi" : "t-val"}>{fmt(m, r.t, true)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function series(grid: Map<string, Map<string, Totals>> | null, by2: GroupBy) {
  const cols = new Set<string>();
  grid?.forEach((row) => row.forEach((_, k) => cols.add(k)));
  const order = [...cols].sort((a, b) => (by2 === "dow" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(a) - ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(b) : a.localeCompare(b)));
  return order;
}

function Lines({ m, grid, by, by2, order }: { m: MetricDef; grid: Map<string, Map<string, Totals>> | null; by: GroupBy; by2: GroupBy; order: string[] }) {
  const cols = series(grid, by2);
  const groups = (by === "none" ? ["All"] : order).slice(0, 6);
  const W = 900, H = 340, L = 10, Rr = 150, T = 16, B = 30;
  const vals = groups.flatMap((g) => cols.map((c) => { const t = grid?.get(g)?.get(c); return t ? m.value(t) ?? 0 : 0; }));
  const max = Math.max(1e-9, ...vals);
  const X = (i: number) => L + (i / Math.max(cols.length - 1, 1)) * (W - L - Rr), Y = (v: number) => H - B - (v / max) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} over time`} className="rb-svg">
      <Style />
      {[0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - Rr} y1={Y(max * f)} y2={Y(max * f)} stroke="#262626" /><text x={W - Rr + 6} y={Y(max * f) + 4} className="t-ax">{m.kind === "money" ? moneyK(max * f) : m.kind === "rate" ? pct(max * f, 0) : n0(max * f)}</text></g>)}
      {groups.map((g, gi) => {
        const pts = cols.map((c, i) => { const t = grid?.get(g)?.get(c); return [X(i), Y(t ? m.value(t) ?? 0 : 0)]; });
        const last = pts[pts.length - 1];
        return (
          <g key={g}>
            <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={SERIES[gi]} strokeWidth={gi === 0 ? 3 : 1.8} />
            {last ? <text x={W - Rr + 6} y={last[1] + 4 + gi * 0} className="t-lab" fill={SERIES[gi]} style={{ fill: SERIES[gi] }}>{label(by, g).slice(0, 18)}</text> : null}
          </g>
        );
      })}
      {cols.map((c, i) => (cols.length <= 14 || i % Math.ceil(cols.length / 12) === 0 ? <text key={c} x={X(i)} y={H - 10} textAnchor="middle" className="t-ax">{label(by2, c)}</text> : null))}
    </svg>
  );
}

function Heat({ m, grid, by, by2, order }: { m: MetricDef; grid: Map<string, Map<string, Totals>> | null; by: GroupBy; by2: GroupBy; order: string[] }) {
  const cols = series(grid, by2);
  const rows = (by === "none" ? ["All"] : order).slice(0, 30);
  const cw = Math.max(26, Math.min(60, 700 / Math.max(cols.length, 1))), rh = 26, L = 190, T = 28;
  const W = L + cols.length * cw + 10, H = T + rows.length * rh + 6;
  const vals = rows.flatMap((g) => cols.map((c) => { const t = grid?.get(g)?.get(c); return t ? m.value(t) : null; })).filter((v): v is number => v != null);
  const max = Math.max(1e-9, ...vals);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} heat grid`} className="rb-svg">
      <Style />
      {cols.map((c, i) => <text key={c} x={L + i * cw + cw / 2} y={18} textAnchor="middle" className="t-ax">{label(by2, c)}</text>)}
      {rows.map((g, r) => (
        <g key={g}>
          <text x={L - 10} y={T + r * rh + 17} textAnchor="end" className="t-lab">{label(by, g).slice(0, 26)}</text>
          {cols.map((c, i) => {
            const t = grid?.get(g)?.get(c), v = t ? m.value(t) : null;
            const a = v == null ? 0 : Math.max(0.08, v / max);
            return (
              <g key={c}>
                <rect x={L + i * cw + 1} y={T + r * rh + 1} width={cw - 2} height={rh - 2} fill={v == null ? "#141414" : `rgba(57,255,20,${a.toFixed(3)})`}><title>{`${label(by, g)} · ${label(by2, c)}: ${fmt(m, t)}${counts(m, t)}`}</title></rect>
                {cw >= 44 && v != null ? <text x={L + i * cw + cw / 2} y={T + r * rh + 17} textAnchor="middle" className="t-cell" style={{ fill: a > 0.55 ? "#0A0A0A" : "#D4D4D4" }}>{fmt(m, t, true)}</text> : null}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function Podium({ m, rows, by }: { m: MetricDef; rows: { k: string; t: Totals }[]; by: GroupBy }) {
  const top = rows.slice(0, 3), rest = rows.slice(3, 10);
  const W = 900, H = 420, base = 330, w = 220;
  const spots = [{ i: 1, x: 120, h: 150 }, { i: 0, x: 340, h: 220 }, { i: 2, x: 560, h: 110 }];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Top 3 by ${m.label}`} className="rb-svg">
      <Style />
      {spots.map(({ i, x, h }) => {
        const r = top[i];
        if (!r) return null;
        const first = i === 0;
        return (
          <g key={i}>
            <rect x={x} y={base - h} width={w} height={h} fill={first ? NEON : "#1E1E1E"} stroke={first ? NEON : "#3A3A3A"} />
            <text x={x + w / 2} y={base - h + 56} textAnchor="middle" className="t-place" style={{ fill: first ? "#0A0A0A" : "#FFFFFF" }}>{i + 1}</text>
            <text x={x + w / 2} y={base - h - 46} textAnchor="middle" className="t-name">{label(by, r.k).slice(0, 22).toUpperCase()}</text>
            <text x={x + w / 2} y={base - h - 14} textAnchor="middle" className="t-big" style={{ fill: first ? NEON : "#FFFFFF" }}>{fmt(m, r.t, true)}</text>
          </g>
        );
      })}
      <line x1={80} x2={W - 80} y1={base} y2={base} stroke="#3A3A3A" />
      {rest.map((r, j) => (
        <text key={r.k} x={80 + (j % 4) * 190} y={base + 32 + Math.floor(j / 4) * 26} className="t-lab">{`${j + 4}. ${label(by, r.k).slice(0, 18)}  ${fmt(m, r.t, true)}`}</text>
      ))}
    </svg>
  );
}

function Race({ m, grid, by, by2 }: { m: MetricDef; grid: Map<string, Map<string, Totals>> | null; by: GroupBy; by2: GroupBy }) {
  const cols = series(grid, by2);
  const groups = grid ? [...grid.keys()] : [];
  const [step, setStep] = useState(cols.length - 1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setStep(cols.length - 1), [cols.length]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setStep((s) => { if (s >= cols.length - 1) { setPlaying(false); return s; } return s + 1; }), 700);
    return () => clearInterval(id);
  }, [playing, cols.length]);
  // running totals up to the current step (rates are recomputed from running totals, never averaged)
  const run = groups.map((g) => {
    let t = zero();
    cols.slice(0, step + 1).forEach((c) => { const x = grid?.get(g)?.get(c); if (x) t = add(t, x); });
    return { k: g, t, v: m.value(t) ?? 0 };
  }).sort((a, b) => b.v - a.v).slice(0, 10);
  const W = 900, rowH = 32, L = 190, R = 120, H = 10 * rowH + 60;
  const max = Math.max(1e-9, ...run.map((r) => r.v));
  return (
    <div>
      <div className="seg-row" style={{ marginBottom: 8 }}>
        <button type="button" className="btn primary" onClick={() => { if (step >= cols.length - 1) setStep(0); setPlaying(!playing); }}>{playing ? "Pause" : "Play the race"}</button>
        <input type="range" min={0} max={Math.max(cols.length - 1, 0)} value={step} onChange={(e) => { setPlaying(false); setStep(+e.target.value); }} style={{ flex: 1 }} aria-label="Race position" />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} race`} className="rb-svg">
      <Style />
        <text x={W - 20} y={H - 16} textAnchor="end" className="t-race">{cols[step] ? `THROUGH ${label(by2, cols[step]).toUpperCase()}` : ""}</text>
        {run.map((r, i) => (
          <g key={r.k} style={{ transform: `translateY(${10 + i * rowH}px)`, transition: "transform .5s ease" }}>
            <text x={L - 10} y={20} textAnchor="end" className="t-lab">{label(by, r.k).slice(0, 26)}</text>
            <rect x={L} y={4} width={Math.max((r.v / max) * (W - L - R), 1)} height={rowH - 8} fill={i === 0 ? NEON : "#8C8C8C"} style={{ transition: "width .5s ease" }} />
            <text x={L + Math.max((r.v / max) * (W - L - R), 1) + 8} y={20} className={i === 0 ? "t-val hi" : "t-val"}>{fmt(m, r.t, true)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
