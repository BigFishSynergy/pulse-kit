"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useState } from "react";
import QuickReport from "./QuickReport";
import CsrTeam from "./CsrTeam";
import { MeterBadge } from "./HotCold";
import { GoalChip, Seg, usePersist, Win } from "./ui";
import { dfmt, goalClass, goalSay, money, moneyK, n0, n1, paceClass, pct, tidy, written } from "@/lib/pulse/format";
import PowerBoard from "./PowerBoard";

// The Clean look for leadership: the four numbers that matter, one trend, the team on one screen, and two ways to ask
// for anything else (a report or Claude). Same snapshot as the Everything look; nothing here is counted differently.

const PER: [string, string][] = [["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]];
const yearShare = (asOf: string) => {
  const d = new Date(asOf + "T00:00:00Z"), y = d.getUTCFullYear();
  return (d.getTime() - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) + 1 / 365;
};

/** Goal pacing for a board row in a period, the same way the Everything look works it out. */
function pace(s: any, r: any, per: string): { pacing: number; goal: number } | null {
  const g = r.goal ?? {};
  if (per === "week" && g.week != null) return { pacing: r.values.week / g.week, goal: g.week };
  if (per === "quarter" && g.quarter != null && g.quarter_pacing != null) return { pacing: g.quarter_pacing, goal: g.quarter };
  if (per === "year" && g.year != null) return { pacing: r.values.year / (g.year * yearShare(s.as_of)), goal: g.year };
  return null;
}

function change(a: number | null | undefined, b: number | null | undefined, points?: boolean) {
  if (a == null || b == null) return null;
  if (points) { const p = (a - b) * 100; return `${p >= 0 ? "+" : "−"}${Math.abs(p) < 1 ? Math.abs(p).toFixed(1) : Math.round(Math.abs(p))} pts`; }
  if (!b) return a ? "New" : null;
  const c = (a - b) / b;
  return `${c >= 0 ? "+" : "−"}${pct(Math.abs(c), 0)}`;
}

/** One of the four big numbers. Color only comes from the goal: the pace bar, or the chip for close rate. Last year is gray. */
function Kpi({ s, r, per, label }: { s: any; r: any; per: string; label: string }) {
  if (!r) return null;
  const rate = r.fmt === "rate";
  const v = rate ? r.values[per]?.pct : r.values[per], l = rate ? r.ly[per]?.pct : r.ly[per];
  const big = rate ? pct(v, 0) : r.fmt === "money" ? moneyK(v) : n0(v);
  const c = change(v, l, rate);
  const g = rate ? null : pace(s, r, per);
  const st = rate ? goalClass(v, r.goal?.rate) : "";
  return (
    <div className="cl-kpi">
      <span className="cl-k">{label}{rate && r.window ? <Win>last {r.window.days} days</Win> : null}</span>
      <span className="cl-v num">{big}</span>
      {g ? (
        <span className="cl-pace" title={`${pct(g.pacing, 0)} of the pace needed to hit the goal`}>
          <i className={paceClass(g.pacing)} style={{ width: `${Math.min(100, g.pacing * 100)}%` }} />
          <b>{pct(g.pacing, 0)} of pace · goal {r.fmt === "money" ? moneyK(g.goal) : n0(g.goal)}</b>
        </span>
      ) : rate && r.goal?.rate != null ? <span className="goal"><GoalChip state={st}>{goalSay(st, pct(r.goal.rate, 0))}</GoalChip></span> : null}
      <span className="vsly">{c ? `${c} ` : ""}vs {rate ? pct(l, 0) : r.fmt === "money" ? moneyK(l) : n0(l)} last year</span>
    </div>
  );
}

/** Sales by week, 13 weeks. Wide screens put the number on every bar; a phone shows every other one, counted back from
 *  last week, and dates only at the start, middle and end, all level. Weeks over the average line
 *  are the brand color; last week is outlined. */
function WeekBars({ trend }: { trend: any[] }) {
  if (!trend?.length) return null;
  const max = Math.max(1, ...trend.map((w) => w.sales || 0));
  const avg = trend.slice(0, -1).reduce((a, w) => a + (w.sales || 0), 0) / Math.max(1, trend.length - 1);
  const n = trend.length, mid = Math.floor((n - 1) / 2);
  return (
    <div className="cl-weeks" role="img" aria-label={`Sales by week: ${trend.map((w) => `${dfmt(w.week)} ${moneyK(w.sales)}`).join(", ")}`}>
      <div className="cl-weeks-plot">
        {trend.map((w, i) => (
          <div key={w.week} className={`cl-wk${i === n - 1 ? " last" : ""}${(w.sales || 0) > avg ? " over" : ""}${(n - 1 - i) % 2 ? " odd" : ""}`} title={`Week of ${dfmt(w.week)}: ${money(w.sales)}, ${n0(w.jobs_sold)} jobs`}>
            <span className="num">{moneyK(w.sales)}</span>
            <i style={{ height: `${((w.sales || 0) / max) * 100}%` }} />
          </div>
        ))}
        <div className="cl-avg" style={{ bottom: `${(avg / max) * 100}%` }}><span>Average {moneyK(avg)}</span></div>
      </div>
      <div className="cl-weeks-x" aria-hidden="true">{trend.map((w, i) => <span key={w.week} className={i === 0 || i === mid || i === n - 1 ? "key" : ""}>{dfmt(w.week)}</span>)}</div>
    </div>
  );
}

export default function CleanPulse({ s, coaching, repSlugs, canAsk, week, first, photos = {} }: { s: any; coaching: any; repSlugs: Record<string, string>; canAsk: boolean; week: string; first: string; photos?: Record<string, number> }) {
  const [per, setPer] = usePersist("cleanPer", "month", PER.map((p) => p[0]));
  const [q, setQ] = useState("");
  const b = s.board;
  if (!b) return null;
  const P = b.periods[per];
  const row = (m: string) => b.rows.find((r: any) => r.metric === m);
  const cards = s.cards?.windows?.["90"];
  const power: Record<string, any> = Object.fromEntries((cards?.cards ?? []).map((c: any) => [c.rep, c]));
  const temp: Record<string, any> = Object.fromEntries((s.meter?.reps ?? []).map((m: any) => [m.rep, m]));
  const coming = new Set((cards?.coming ?? []).map((c: any) => c.rep));
  const speed: Record<string, any> = Object.fromEntries((cards?.rapid_board?.rows ?? []).map((r: any) => [r.rep, r]));
  // Power rankings: highest POWER first, then rookies earning a card, then everyone else. Sales breaks ties.
  const tier = (r: any) => (power[r.rep] ? 0 : coming.has(r.rep) ? 1 : 2);
  const team = (s.reps ?? []).slice().sort((a: any, z: any) =>
    tier(a) - tier(z) || (power[z.rep]?.power ?? 0) - (power[a.rep]?.power ?? 0) || (z.sales_30 || 0) - (a.sales_30 || 0));
  const focus: string[] = [
    ...(coaching?.priorities ?? []).map((p: any) => p.title),
    ...(coaching?.worth_knowing ?? []),
  ].slice(0, 3).map((t: string) => tidy(t, { noEmoji: true }));
  const gp = s.costs?.windows?.["90"]?.total?.gp, gpGoal = s.costs?.goal;
  const q2 = (r: string) => `/pulse/hq/rep/${repSlugs[r]}${week ? `?week=${week}` : ""}`;
  const ask = (text: string) => `/pulse/hq/ask${week ? `?week=${week}&` : "?"}q=${encodeURIComponent(text)}`;
  const hour = new Date().getHours();

  return (
    <div className="clean">
      <section className="cl-hero">
        <div>
          <span className="cl-hi">{hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, {first}</span>
          <h2>{P.label}<small>{dfmt(P.start)} to {dfmt(P.end)}</small></h2>
        </div>
        <Seg label="Period" value={per} options={PER} onChange={setPer} />
      </section>

      <section className="cl-kpis">
        <Kpi s={s} r={row("Sales")} per={per} label="Sales" />
        <Kpi s={s} r={row("Revenue")} per={per} label="Revenue installed" />
        <Kpi s={s} r={row("Jobs Sold")} per={per} label="Jobs sold" />
        <Kpi s={s} r={row("Close Rate")} per={per} label="Close rate" />
      </section>
      <div className="cl-minis">
        {row("Avg Ticket") ? <span>Avg ticket <b className="num">{money(row("Avg Ticket").values[per])}</b></span> : null}
        {row("Sit Rate") ? <span>Sit rate <b className="num">{pct(row("Sit Rate").values[per]?.pct, 0)}</b></span> : null}
        {row("Upgrades") ? <span>Upgrades <b className="num">{moneyK(row("Upgrades").values[per])}</b></span> : null}
        {gp != null ? <span>GP <b className={`num ${goalClass(gp, gpGoal)}`}>{gp.toFixed(1)}%</b> <small>goal {gpGoal}%</small> <Win>last 90 days</Win></span> : null}
      </div>

      {focus.length ? (
        <section className="cl-focus">
          <span className="cl-k">This week{coaching?.generated_at ? <small>{written(coaching.generated_at)}</small> : null}</span>
          <ol>{focus.map((t, i) => <li key={i}><span className="n num">{i + 1}</span>{t}</li>)}</ol>
        </section>
      ) : null}

      <section className="cl-panel">
        <div className="cl-panel-h"><span className="cl-k">Sales by week</span><Win>last 13 weeks</Win><span className="sub">Monday to Sunday. Dark bars beat the average (the dashed line). The outlined bar is last week.</span></div>
        <WeekBars trend={s.trend} />
      </section>

      <section className="cl-panel">
        <div className="cl-panel-h"><span className="cl-k">Power rankings</span><Win>last 90 days</Win><span className="sub">Highest POWER first. POWER covers the last 90 days and is built from the six skills on each card (the tick on each bar is the team average). The line at the bottom is the last 30 days. Tap a card for that rep&apos;s screen.</span></div>
        <PowerBoard team={team} power={power} temp={temp} coming={coming} href={(rep) => (repSlugs[rep] ? q2(rep) : "#")}
          photo={(rep) => (photos[repSlugs[rep]] ? `/pulse/api/photo/${repSlugs[rep]}?v=${photos[repSlugs[rep]]}` : null)} />
      </section>

      <CsrTeam cc={s.csr_cards} />

      <section className="cl-two">
        <QuickReport asOf={s.as_of} scope="lead" reportsHref="/pulse/hq/reports" />
        {canAsk ? (
          <form className="cl-ask" onSubmit={(e) => { e.preventDefault(); window.location.href = ask(q.trim() || "What should leadership focus on this week?"); }}>
            <span className="cl-cta-k">Ask Claude anything</span>
            <span className="cl-cta-t">About these numbers, a rep, a town or a channel. Plain English.</span>
            <label htmlFor="cl-q" className="visually-hidden">Your question</label>
            <input id="cl-q" type="text" maxLength={800} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which towns should we market to next month?" />
            <button type="submit" className="btn primary">Ask</button>
          </form>
        ) : null}
      </section>

      <p className="cl-foot sub">Data pulled {s.pulled_at ?? dfmt(s.as_of)}. The Map and Team pages are in the menu at the top; Production, Job costing and Marketing are under More. Everything adds the scorecard and trends.</p>
    </div>
  );
}
