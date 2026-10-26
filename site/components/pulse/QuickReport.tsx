"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { aggregate, add, metric, METRICS, zero, type Facts, type GroupBy, type Totals } from "@/lib/pulse/ledger";
import { compareRange, DEFAULT, GROUPS, PRESETS, presetRange, reportHash, TIME, VIEWS, type State } from "./ReportBuilder";
import { dfmt, MON, money, moneyK, n0, pct } from "@/lib/pulse/format";

// The simple way into reports, for the Clean look: one sentence ("Show me Sales by Rep for Quarter to date, vs last
// year"), the answer right under it, ready-made ideas, every option listed so people know what they can ask for, and
// one tap into the full report builder with the same report open. Same ledger and rules as the report builder.

type Idea = { label: string; m: string; by: GroupBy; p: string };
const LEAD_IDEAS: Idea[] = [
  { label: "Sales by rep, this quarter", m: "sales", by: "rep", p: "qtd" },
  { label: "Close rate by rep, last 90 days", m: "close", by: "rep", p: "r90" },
  { label: "Sales by lead channel, this year", m: "sales", by: "src", p: "ytd" },
  { label: "Leads by town, last 30 days", m: "leads", by: "town", p: "r30" },
  { label: "Sales by month, last 12 months", m: "sales", by: "month", p: "r365" },
  { label: "Avg ticket by county, this year", m: "ticket", by: "county", p: "ytd" },
  { label: "Sales per lead by channel, last 90 days", m: "spl", by: "src", p: "r90" },
  { label: "GP % by month, this year", m: "gp", by: "month", p: "ytd" },
  { label: "Sits by day of week, last 90 days", m: "sits", by: "dow", p: "r90" },
];
const REP_IDEAS: Idea[] = [
  { label: "My sales by month, last 12 months", m: "sales", by: "month", p: "r365" },
  { label: "My demo conversion by lead channel, last 90 days", m: "demo_conv", by: "src", p: "r90" },
  { label: "My sales by town, this year", m: "sales", by: "town", p: "ytd" },
  { label: "My avg ticket by lead channel, this year", m: "ticket", by: "src", p: "ytd" },
  { label: "My sits by day of week, last 90 days", m: "sits", by: "dow", p: "r90" },
  { label: "My jobs sold by week, this quarter", m: "jobs", by: "week", p: "qtd" },
];
const SHOW = 12;

function keyLabel(by: GroupBy, k: string) {
  if (by === "month") return `${MON[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
  if (by === "week") return `Week of ${dfmt(k)}`;
  return k;
}

export default function QuickReport({ asOf, scope, rep, reportsHref }: { asOf: string; scope: "lead" | "rep"; rep?: string; reportsHref: string }) {
  const ideas = scope === "rep" ? REP_IDEAS : LEAD_IDEAS;
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [err, setErr] = useState("");
  const [m, setM] = useState(ideas[0].m);
  const [by, setBy] = useState<GroupBy>(ideas[0].by);
  const [p, setP] = useState(ideas[0].p);
  const [ly, setLy] = useState(true);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (!open || facts) return;
    fetch(`/pulse/api/facts${rep ? `?rep=${rep}` : ""}`)
      .then(async (r) => (r.ok ? setFacts(await r.json()) : setErr((await r.json()).error || "Could not load the data.")))
      .catch(() => setErr("Could not load the data."));
  }, [open, facts, rep]);

  const md = metric(m);
  const presets = PRESETS.filter(([k]) => k !== "custom");
  const groups = GROUPS.filter(([k]) => !(scope === "rep" && k === "rep"));
  const [start, end] = facts ? presetRange(p, asOf, facts.epoch) : ["", ""];
  const cmp = ly && facts ? compareRange(start, end, "ly") : null;
  // grouping by rep compares the sales team (the rules' default); everything else counts the whole company
  const filters = useMemo(() => ({ teamOnly: scope === "lead" && by === "rep", closeTeam: true }), [scope, by]);
  const cur = useMemo(() => (facts ? aggregate(facts, start, end, filters, by) : null), [facts, start, end, filters, by]);
  const prev = useMemo(() => (facts && cmp ? aggregate(facts, cmp[0], cmp[1], filters, by) : null), [facts, cmp?.[0], cmp?.[1], filters, by]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = (t?: Totals) => {
    const v = t ? md.value(t) : null;
    if (v == null) return "–";
    return md.kind === "money" ? money(v) : md.kind === "rate" ? pct(v, 1) : n0(v);
  };
  const change = (a?: Totals, b?: Totals) => {
    const x = a ? md.value(a) : null, y = b ? md.value(b) : null;
    if (x == null || y == null) return null;
    if (md.kind === "rate") return { txt: `${x - y >= 0 ? "+" : ""}${((x - y) * 100).toFixed(1)} pts`, up: x >= y };
    if (!y) return x ? { txt: "New", up: true } : null;
    const c = (x - y) / y;
    return { txt: `${c >= 0 ? "+" : ""}${pct(c, 0)}`, up: c >= 0 };
  };
  const Chip = ({ c }: { c: ReturnType<typeof change> }) => (c ? <span className="chg">{c.txt}</span> : null);

  const tot = (g: Map<string, Map<string, Totals>> | null, k: string) => g?.get(k)?.get("All");
  let rows = cur ? [...cur.keys()].map((k) => ({ k, t: tot(cur, k)!, p: tot(prev, k) })).filter((r) => (md.value(r.t) ?? 0) !== 0) : [];
  if (TIME.includes(by)) rows.sort((a, b) => (by === "dow" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(a.k) - ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(b.k) : a.k.localeCompare(b.k)));
  else rows.sort((a, b) => (md.value(b.t) ?? -Infinity) - (md.value(a.t) ?? -Infinity));
  const total = rows.reduce((t, r) => add(t, r.t), zero());
  const totalPrev = prev ? [...prev.keys()].reduce((t, k) => add(t, tot(prev, k)!), zero()) : undefined;
  const max = Math.max(...rows.map((r) => md.value(r.t) ?? 0), 0) || 1;
  const timeline = TIME.includes(by) && by !== "dow";
  const listed = all ? rows : timeline ? rows.slice(-SHOW) : rows.slice(0, SHOW);
  const pick = (i: Idea) => { setM(i.m); setBy(i.by); setP(i.p); setAll(false); };

  const full: State = { ...DEFAULT, preset: p, compare: ly ? "ly" : "none", metrics: [m, ...DEFAULT.metrics.filter((x) => x !== m)].slice(0, 4), by,
    view: TIME.includes(by) ? "lines" : "bars", who: scope === "lead" && by === "rep" ? "team" : "company" };
  let href = reportsHref;
  try { href = reportsHref + reportHash(full); } catch {}

  if (!open) {
    return (
      <button type="button" className="cl-cta" onClick={() => setOpen(true)}>
        <span className="cl-cta-k">Make any report</span>
        <span className="cl-cta-t">Pick what, how to split it and when. The answer shows up right here.</span>
        <span className="cl-cta-go">Build a report →</span>
      </button>
    );
  }

  return (
    <section className="qr" aria-label="Make any report">
      <div className="qr-head">
        <div>
          <h2>Make any report you want</h2>
          <p className="sub">Change any word below. Every option is listed under the report.</p>
        </div>
        <button type="button" className="link" onClick={() => setOpen(false)}>Close</button>
      </div>
      <div className="qr-sentence">
        <span>Show me</span>
        <label><span className="visually-hidden">Measure</span>
          <select value={m} onChange={(e) => setM(e.target.value)}>{METRICS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        </label>
        <span>by</span>
        <label><span className="visually-hidden">Group by</span>
          <select value={by} onChange={(e) => { setBy(e.target.value as GroupBy); setAll(false); }}>{groups.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <span>for</span>
        <label><span className="visually-hidden">Dates</span>
          <select value={p} onChange={(e) => setP(e.target.value)}>{presets.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="qr-ly"><input type="checkbox" checked={ly} onChange={(e) => setLy(e.target.checked)} /> vs last year</label>
      </div>
      <div className="qr-ideas" aria-label="Ready-made reports">
        {ideas.map((i) => <button key={i.label} type="button" className={`chip${i.m === m && i.by === by && i.p === p ? " on" : ""}`} onClick={() => pick(i)}>{i.label}</button>)}
      </div>

      {err ? <div className="empty-note">{err}</div> : !facts || !cur ? <div className="empty-note">Loading every lead, sit, sale and install...</div> : (
        <div className="qr-out">
          <div className="qr-total">
            <span className="label">{md.label}{by !== "none" ? ` by ${GROUPS.find((g) => g[0] === by)?.[1].toLowerCase()}` : ""}{filters.teamOnly ? " (sales team)" : ""} · {dfmt(start)} {start.slice(0, 4)} to {dfmt(end)} {end.slice(0, 4)}</span>
            <span className="qr-big num">{show(total)}</span>
            {cmp ? <span className="sub"><Chip c={change(total, totalPrev)} /> vs {show(totalPrev)} the same dates last year</span> : null}
          </div>
          {by !== "none" ? (
            rows.length ? (
              <ol className={`qr-bars${TIME.includes(by) ? " time" : ""}`}>
                {listed.map((r, i) => {
                  const v = md.value(r.t) ?? 0;
                  return (
                    <li key={r.k} className={!TIME.includes(by) && i === 0 ? "top" : ""}>
                      <span className="qr-k">{keyLabel(by, r.k)}</span>
                      <span className="qr-bar"><i style={{ width: `${Math.max(1, (v / max) * 100)}%` }} /></span>
                      <span className="qr-v num">{show(r.t)}</span>
                      <span className="qr-c">{cmp ? <Chip c={change(r.t, r.p)} /> : null}</span>
                    </li>
                  );
                })}
              </ol>
            ) : <div className="empty-note">Nothing to show for these dates.</div>
          ) : null}
          {rows.length > SHOW ? <button type="button" className="link" onClick={() => setAll(!all)}>{all ? `Show the ${timeline ? "latest" : "top"} ${SHOW}` : `Show all ${rows.length}`}</button> : null}
          <div className="qr-actions">
            {/* a full page load, so the report builder reads the report from the address bar when it starts */}
            <a className="btn primary" href={href}>Open this in the full report builder</a>
            <span className="sub">Add more measures, filter to reps or lead channels, download it, or show it as {VIEWS.map((v) => v[1].toLowerCase()).join(", ")}.</span>
          </div>
        </div>
      )}

      <details className="qr-menu" open>
        <summary>Everything you can ask for</summary>
        <div className="qr-cols">
          <div><span className="label">What ({METRICS.length})</span><ul>{METRICS.map((x) => <li key={x.key}><button type="button" className="link" onClick={() => setM(x.key)}>{x.label}</button></li>)}</ul></div>
          <div><span className="label">Split by ({groups.length})</span><ul>{groups.map(([k, l]) => <li key={k}><button type="button" className="link" onClick={() => { setBy(k); setAll(false); }}>{l}</button></li>)}</ul></div>
          <div><span className="label">When ({presets.length + 1})</span><ul>{presets.map(([k, l]) => <li key={k}><button type="button" className="link" onClick={() => setP(k)}>{l}</button></li>)}<li className="sub">Any custom dates, in the full builder</li></ul></div>
          <div><span className="label">And also</span><ul>
            <li>Compare to the period before or the same dates last year</li>
            {scope === "lead" ? <li>Pick certain reps, or the whole company</li> : null}
            <li>Filter to certain lead channels</li>
            <li>Split by two things at once (like rep by month)</li>
            <li>Show it as {VIEWS.map((v) => v[1].toLowerCase()).join(", ")}</li>
            <li>Download a CSV or an image, or turn it into a graphic</li>
          </ul></div>
        </div>
      </details>
    </section>
  );
}
