"use client";
import SecHelp from "./SecHelp";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Seg, usePersist } from "./ui";
import { dfmt, goalClass, mlabel, money, moneyK, n0 } from "@/lib/pulse/format";
import { CRM } from "@/lib/pulse/config";

// Job costing and GP, from the Job Expenses report and the rules (site/pipeline/costs.py).
// Closed jobs only, by Closed date (upgrades in); GP % always matches the rules' GP % metric. Goal from rules/settings.json.

const WIN: [string, string][] = [["qtd", "Quarter"], ["ytd", "Year"], ["90", "90 days"], ["365", "12 months"]];
const COLORS: Record<string, string> = {
  Material: "#8C8C8C", Labor: "#6E6E6E", Commission: "#D22B2B", Dump: "#4A4A4A", "CC Fee": "#5A5A5A",
  Warranty: "#3A3A3A", "Sales Tax": "#333333", Permits: "#2C2C2C", Marketing: "#262626", Other: "#202020",
};
const p1 = (v: number | null | undefined) => (v == null ? "–" : `${v.toFixed(1)}%`);
// company and my-own numbers: green at goal, amber close, red behind. Other people's rows only ever get green (never call anyone out).
const gpCls = (gp: number | null | undefined, goal: number) => goalClass(gp, goal);
const gpRow = (gp: number | null | undefined, goal: number) => (gp != null && gp >= goal ? "good" : "");
const span = (w: any) => `${dfmt(w.start)} ${w.start.slice(0, 4)} to ${dfmt(w.end)} ${w.end.slice(0, 4)}`;

function Rec({ rr, url }: { rr: string | null; url: string | null }) {
  return url ? <a href={url} target="_blank" rel="noreferrer">{rr || "Open"}</a> : <>{rr || "–"}</>;
}

/** Where every dollar of job value went: each cost bucket, then gross profit, as one bar. */
function CostBar({ t }: { t: any }) {
  const parts = Object.entries(t.buckets ?? {}).filter(([, b]: any) => (b.pct ?? 0) > 0.2) as [string, any][];
  return (
    <div className="costbar">
      <div className="bar" role="img" aria-label="Share of job value by cost and gross profit">
        {parts.map(([k, b]) => <i key={k} style={{ width: `${b.pct}%`, background: COLORS[k] ?? "#333" }} title={`${k} ${p1(b.pct)}`} />)}
        <i className="gp" style={{ width: `${Math.max(0, t.gp ?? 0)}%` }} title={`Gross profit ${p1(t.gp)}`} />
      </div>
      <ul className="cb-legend">
        {parts.map(([k, b]) => <li key={k}><i style={{ background: COLORS[k] ?? "#333" }} />{k} <b>{p1(b.pct)}</b> <span className="sub">{moneyK(b.d)}</span></li>)}
        <li><i className="gp" />Gross profit <b>{p1(t.gp)}</b> <span className="sub">{moneyK(t.profit)}</span></li>
      </ul>
    </div>
  );
}

/** GP % by the month jobs went Closed: every bar carries its number, green at or over the goal, dashed red goal line across. */
function MonthlyGP({ rows, goal }: { rows: any[]; goal: number }) {
  const max = Math.max(goal + 8, ...rows.map((r) => r.gp ?? 0));
  const y = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  return (
    <div className="gpm" role="img" aria-label={`GP by closed month: ${rows.map((r) => `${mlabel(r.month + "-01", true)} ${p1(r.gp)}`).join(", ")}. Goal ${goal}%.`}>
      <div className="gpm-plot"><div className="gpm-area">
        {rows.map((r) => {
          const v = r.gp ?? 0;
          return (
            <div key={r.month} className={`gpm-col${v >= goal ? " hit" : ""}${r.jobs < 10 ? " thin" : ""}`} title={`${mlabel(r.month + "-01", true)}: ${p1(r.gp)} GP on ${r.jobs} jobs, ${moneyK(r.profit)} profit`}>
              <div className="gpm-bar" style={{ height: y(v) }}><span className="num">{r.gp == null ? "–" : r.gp.toFixed(1)}<i>%</i></span></div>
            </div>
          );
        })}
        <div className="gpm-goal" style={{ bottom: y(goal) }}><span>{goal}%<b> goal</b></span></div>
      </div></div>
      <div className="gpm-x" aria-hidden="true">{rows.map((r, i) => <span key={r.month}>{mlabel(r.month + "-01")}{i === 0 || r.month.endsWith("-01") ? ` '${r.month.slice(2, 4)}` : ""}<small>{r.jobs} jobs</small></span>)}</div>
    </div>
  );
}

/** Leadership: job costing and GP for the whole company. */
export default function JobCosting({ c }: { c: any }) {
  const [win, setWin] = usePersist("costWin", "365", WIN.map((w) => w[0]));
  const [by, setBy] = useState("rep");
  if (!c?.windows) return null;
  const W = c.windows[win], t = W.total, goal = c.goal, D = c.discounts[win];
  const groups: Record<string, any[]> = { rep: W.by_rep, work: W.by_work, trade: W.by_trade };
  const rows = (groups[by] ?? []).slice().sort((a, b) => b.value - a.value);
  const flags = Object.values(c.flags ?? {}).filter((f: any) => f.count > 0) as any[];
  return (
    <section id="costs">
      <div className="sechead">
        <h2>Job costing and GP <small>{W.label}, {span(W)}. Jobs by the date they went Closed, the company&apos;s rules. Goal {goal}%.</small> <SecHelp k="costs" /></h2>
        <Seg label="Cost window" value={win} options={WIN} onChange={setWin} />
      </div>
      <div className="strip">
        <div><span className="label">Gross profit</span><span className={`big num ${gpCls(t.gp, goal)}`}>{p1(t.gp)}</span><span className="sub">{t.gp != null ? `${(t.gp - goal >= 0 ? "+" : "")}${(t.gp - goal).toFixed(1)} points vs the ${goal}% goal` : "No closed jobs yet"}</span></div>
        <div><span className="label">Profit</span><span className="big num">{moneyK(t.profit)}</span><span className="sub">on {moneyK(t.value)} of job value</span></div>
        <div><span className="label">Closed jobs</span><span className="big num">{n0(t.jobs)}</span><span className="sub">Upgrades included. {W.left_out.no_costs} jobs with no costs loaded left out</span></div>
        <div><span className="label">Call backs</span><span className="big num">{moneyK(W.callbacks.cost)}</span><span className="sub">rework cost on {n0(W.callbacks.jobs)} call back jobs</span></div>
      </div>
      <CostBar t={t} />
      {c.monthly?.length ? (<div><span className="label">GP by closed month <span className="sub">Last 12 months. Green is at or over the {goal}% goal. Faded bars have fewer than 10 jobs.</span></span><MonthlyGP rows={c.monthly} goal={goal} /></div>) : null}

      <div className="sechead">
        <span className="label">GP by</span>
        <Seg label="GP by" value={by} options={[["rep", "Rep"], ["work", "Work type"], ["trade", "Trade"]]} onChange={setBy} />
      </div>
      <div className="tbl">
        <table className="tight">
          <thead><tr><th>{by === "rep" ? "Rep" : by === "work" ? "Work type" : "Trade"}</th><th className="r">Jobs</th><th className="r">Job value</th><th className="r">Material</th><th className="r">Labor</th><th className="r">Commission</th><th className="r">GP</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.key}>
              <td className="m">{r.key}</td><td className="r num">{n0(r.jobs)}</td><td className="r num">{moneyK(r.value)}</td>
              <td className="r num">{p1(r.buckets.Material?.pct)}</td><td className="r num">{p1(r.buckets.Labor?.pct)}</td><td className="r num">{p1(r.buckets.Commission?.pct)}</td>
              <td className={`r num ${gpRow(r.gp, goal)}`}>{p1(r.gp)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="two">
        <div>
          <span className="label">Crews <span className="sub">Labor and dump paid to each crew with 3 or more jobs, and GP on the jobs they worked</span></span>
          <div className="tbl"><table className="tight">
            <thead><tr><th>Crew</th><th className="r">Jobs</th><th className="r">Labor</th><th className="r">Dump</th><th className="r">GP</th></tr></thead>
            <tbody>{W.crews.filter((r: any) => r.jobs >= 3).slice(0, 15).map((r: any) => (
              <tr key={r.crew}><td className="m">{r.crew}</td><td className="r num">{n0(r.jobs)}</td><td className="r num">{moneyK(r.labor)}</td><td className="r num">{moneyK(r.dump)}</td><td className={`r num ${gpRow(r.gp, goal)}`}>{p1(r.gp)}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div>
          <span className="label">Where the material and dump money goes <span className="sub">Last 12 months</span></span>
          <ul className="mini">{(c.vendors ?? []).map((v: any) => <li key={v.vendor}><span>{v.vendor} <span className="sub">{v.bucket}</span></span><span className="num">{moneyK(v.spend)}</span></li>)}</ul>
        </div>
      </div>

      <div>
        <span className="label">Discounts <span className="sub">Sold jobs, {D.label.toLowerCase()}. Pre-season 8% + no financing 7% + preferred homeowner 5% = 20% max. Over 20%, the rep pays half of the overage.</span></span>
        <div className="strip three">
          <div><span className="label">Average discount</span><span className="big num">{p1(D.avg_pct)}</span><span className="sub">on {n0(D.jobs)} sold jobs</span></div>
          <div><span className="label">Over the 20% max</span><span className={`big num ${D.over_n ? "bad" : "good"}`}>{n0(D.over_n)}</span><span className="sub">jobs, {money(D.over_total)} over</span></div>
          <div><span className="label">Reps owe</span><span className="big num">{money(D.owes_total)}</span><span className="sub">half of the overage</span></div>
        </div>
        <div className="two">
          <div className="tbl"><table className="tight">
            <thead><tr><th>Rep</th><th className="r">Jobs</th><th className="r">Avg discount</th><th className="r">Over max</th><th className="r">Owes</th></tr></thead>
            <tbody>{(D.by_rep ?? []).map((r: any) => <tr key={r.rep}><td className="m">{r.rep}</td><td className="r num">{n0(r.jobs)}</td><td className="r num">{p1(r.avg_pct)}</td><td className="r num">{n0(r.over_n)}</td><td className="r num">{money(r.owes)}</td></tr>)}</tbody>
          </table></div>
          <div className="tbl"><table className="tight">
            <thead><tr><th>Biggest over the max</th><th>Rep</th><th className="r">Discount</th><th className="r">Owes</th></tr></thead>
            <tbody>{(D.worst ?? []).slice(0, 8).map((r: any) => <tr key={r.rr}><td><Rec rr={r.rr} url={r.url} /></td><td>{r.rep}</td><td className="r num">{p1(r.pct)}</td><td className="r num">{money(r.owes)}</td></tr>)}</tbody>
          </table></div>
        </div>
      </div>

      {flags.length ? (
        <div>
          <span className="label">Cost flags <span className="sub">Last 90 days. Cost data that looks wrong; fix it in {CRM} and GP gets more accurate.</span></span>
          <ul className="notes">{flags.map((f: any) => (
            <li key={f.label}><span className="who">{f.count}</span>{f.label}: {f.rows.map((r: any, i: number) => <span key={i}>{i ? ", " : ""}<Rec rr={r.rr} url={r.url} /></span>)}{f.count > f.rows.length ? ` and ${f.count - f.rows.length} more` : ""}</li>
          ))}</ul>
        </div>
      ) : null}
      <p className="explain">From the Job Expenses report, which covers Closed jobs from the last 365 days (since {dfmt(c.covers_from)}). Profit comes from the job export and already includes commissions; an unpaid balance comes off profit. Upgrades, call backs, and jobs with $0 or 100% profit (costs not loaded) are left out of GP, the same as the company&apos;s GP % metric.</p>
    </section>
  );
}

/** A rep's own GP and discounts. */
export function MyCosts({ c }: { c: any }) {
  const [win, setWin] = usePersist("myCostWin", "365", ["qtd", "ytd", "365"]);
  if (!c?.windows) return null;
  const W = c.windows[win], D = c.discounts[win], goal = c.goal, me = W?.me;
  return (
    <section id="mycosts">
      <div className="sechead">
        <h2>My GP and discounts <small>{W.label}, {span(W)}. Your jobs by the date they went Closed, the company&apos;s rules. Goal {goal}%.</small> <SecHelp k="costs" role="rep" /></h2>
        <Seg label="My cost window" value={win} options={[["qtd", "Quarter"], ["ytd", "Year"], ["365", "12 months"]]} onChange={setWin} />
      </div>
      <div className="strip three">
        <div><span className="label">My GP</span><span className={`big num ${gpCls(me?.gp, goal)}`}>{p1(me?.gp)}</span><span className="sub">{me ? `on ${n0(me.jobs)} closed jobs · team ${p1(W.team_gp)}` : "No closed jobs in this window yet"}</span></div>
        <div><span className="label">My average discount</span><span className="big num">{p1(D.avg_pct)}</span><span className="sub">on {n0(D.jobs)} sold jobs · max 20%</span></div>
        <div><span className="label">Over the 20% max</span><span className={`big num ${D.over_n ? "bad" : "good"}`}>{n0(D.over_n)}</span><span className="sub">{D.over_n ? (D.owes_total != null ? `you owe ${money(D.owes_total)}, half of the overage` : `${money(D.over_total)} over in total`) : "Nice. Every job inside the max."}</span></div>
      </div>
      {me ? <CostBar t={me} /> : null}
      {D.worst?.length ? (
        <div className="tbl"><table className="tight">
          <thead><tr><th>Over the max</th><th className="r">Discount</th><th className="r">Over</th>{D.owes_total != null ? <th className="r">You owe</th> : null}</tr></thead>
          <tbody>{D.worst.map((r: any) => <tr key={r.rr}><td><Rec rr={r.rr} url={r.url} /></td><td className="r num">{p1(r.pct)}</td><td className="r num">{money(r.over)}</td>{D.owes_total != null ? <td className="r num">{money(r.owes)}</td> : null}</tr>)}</tbody>
        </table></div>
      ) : null}
    </section>
  );
}
