"use client";
import Link from "next/link";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Bars, barStats, LineChart, YearSwatch, type YearSeries } from "./charts";
import SecHelp, { PageHelp } from "./SecHelp";
import { AskTeaser } from "./AskPage";
import { LEAD_ASK, LEAD_HELP } from "./askChips";
import GraphicMaker from "./GraphicMaker";
import Welcome from "./Welcome";
import { ChangeChip, GoalChip, RateTxt, Seg, usePersist, Win } from "./ui";
import { dfmt, goalClass, goalSay, goalWord, metricName, MON, mlabel, money, moneyK, moneyS, n0, n1, paceClass, paceWord, pct, tidy, written } from "@/lib/pulse/format";
import { CO, CONFIG, CRM } from "@/lib/pulse/config";
import { REGIONS } from "@/lib/pulse/county";

// The leadership Pulse, Everything look: the summary (top numbers, Priorities, notes, scorecard, trends) and a link to
// each deeper page. The map, the team, production, job costing and marketing each have their own page now (one job per page); their sections are exported from here so those pages draw them the same way.
// Everything shown comes from the hourly snapshot.

const PER = [["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]] as [string, string][];
const SPEND_SHEET = CONFIG.goals.spend_sheet_id ? `https://docs.google.com/spreadsheets/d/${CONFIG.goals.spend_sheet_id}/edit` : "";

type Props = { s: any; geo?: any; coaching: any; repSlugs: Record<string, string>; canAsk: boolean; week: string; first?: string };

const isRate = (r: any) => r.fmt === "rate" || r.fmt === "gp";
/** A number inside a sentence: dollars as $257K, everything else as the chart shows it. */
const sayS = (fmt: (v: any) => string, v: any) => (fmt === money ? moneyS(v) : fmt(v));
const rv = (r: any, v: any) => (isRate(r) ? v && v.pct : v);

function FmtVal({ r, v }: { r: any; v: any }) {
  if (v == null) return <>–</>;
  switch (r.fmt) {
    case "money": return <>{money(v)}</>;
    case "count": return <>{n0(v)}</>;
    case "pct": return <>{pct(v)}</>;
    case "rate": return <RateTxt r={v} />;
    case "gp": return <>{v && v.pct != null ? pct(v.pct) : "–"}</>;
  }
  return <>{String(v)}</>;
}
const plainVal = (r: any, v: any) => {
  if (v == null) return "–";
  if (r.fmt === "money") return money(v);
  if (r.fmt === "count") return n0(v);
  if (r.fmt === "pct") return pct(v);
  return v.pct != null ? pct(v.pct) : "–";
};

function yearShare(asOf: string) {
  const [y, m, d] = asOf.split("-").map(Number);
  const start = Date.UTC(y, 0, 1), now = Date.UTC(y, m - 1, d), end = Date.UTC(y, 11, 31);
  return ((now - start) / 864e5 + 1) / ((end - start) / 864e5 + 1);
}
function rowGoal(s: any, r: any, per: string): any {
  if (r.goal.rate != null) return { goal: r.goal.rate, rate: true };
  if (per === "week" && r.goal.week != null) return { goal: r.goal.week, target: r.goal.week, pacing: r.values.week / r.goal.week };
  if (per === "quarter" && r.goal.quarter != null) return { goal: r.goal.quarter, target: r.goal.quarter_pace, pacing: r.goal.quarter_pacing };
  if (per === "year" && r.goal.year != null) {
    const t = r.goal.year * yearShare(s.as_of);
    return { goal: r.goal.year, target: t, pacing: r.values.year / t };
  }
  return null;
}
function Chg({ r, cur, ly }: { r: any; cur: any; ly: any }) {
  return <ChangeChip a={rv(r, cur)} b={rv(r, ly)} points={isRate(r) || r.fmt === "pct"} />;
}

function PaceBar({ pacing }: { pacing: number }) {
  const w = (Math.min(pacing, 1.5) / 1.5) * 100;
  return (
    <div className="pace">
      <div className="track"><div className="fill" style={{ width: `${w.toFixed(1)}%` }} /><div className="mark" style={{ left: `${(100 / 1.5).toFixed(2)}%` }} /></div>
      <span className="pct num">{pct(pacing, 0)}</span>
      <span className={`chip ${paceClass(pacing)}`}>{paceWord(pacing)}</span>
    </div>
  );
}

/** Where a board row stands against its goal for the period, if it has one: a colored chip and the goal. */
function GoalLine({ r, g, v }: { r: any; g: any; v: any }) {
  if (!g) return null;
  if (g.rate) {
    const st = goalClass(rv(r, v), g.goal);
    return st ? <span className="goal"><GoalChip state={st}>{goalSay(st, r.fmt === "money" ? moneyK(g.goal) : pct(g.goal, 0))}</GoalChip></span> : null;
  }
  if (g.pacing == null || !isFinite(g.pacing)) return null;
  return <span className="goal"><GoalChip state={paceClass(g.pacing)}>{pct(g.pacing, 0)} of pace</GoalChip> goal {r.fmt === "money" ? moneyK(g.goal) : n0(g.goal)}</span>;
}

function Strip({ s, per, setPer }: { s: any; per: string; setPer: (v: string) => void }) {
  const b = s.board; if (!b) return null;
  const P = b.periods[per];
  const row = (m: string) => b.rows.find((r: any) => r.metric === m);
  const Cell = ({ r }: { r: any }) => {
    if (!r) return null;
    const g = rowGoal(s, r, per);
    const big = r.fmt === "rate" ? pct(r.values[per]?.pct, 0) : r.fmt === "money" ? moneyK(r.values[per]) : plainVal(r, r.values[per]);
    return (
      <div>
        <span className="label">{metricName(r.metric)}{r.window ? <Win>last {r.window.days} days</Win> : null}</span>
        <span className="big num">{big}</span>
        <GoalLine r={r} g={g} v={r.values[per]} />
        <span className="vsly"><Chg r={r} cur={r.values[per]} ly={r.ly[per]} /> vs {r.fmt === "rate" ? pct(r.ly[per]?.pct, 0) : r.fmt === "money" ? moneyK(r.ly[per]) : plainVal(r, r.ly[per])} last year</span>
      </div>
    );
  };
  return (
    <section>
      <div className="sechead">
        <div><h2>{P.label} <small>{dfmt(P.start)} to {dfmt(P.end)} · last year {dfmt(P.ly_start)} to {dfmt(P.ly_end)}</small> <SecHelp k="strip" /></h2></div>
        <Seg label="Period" value={per} options={PER} onChange={setPer} />
      </div>
      <div className="strip"><Cell r={row("Sales")} /><Cell r={row("Revenue")} /><Cell r={row("Jobs Sold")} /><Cell r={row("Close Rate")} /></div>
    </section>
  );
}

function Scorecard({ s, per, setPer }: { s: any; per: string; setPer: (v: string) => void }) {
  const b = s.board; if (!b) return null;
  const P = b.periods[per];
  const extra = (s.scorecard || []).filter((r: any) => r.source === "goals sheet");
  return (
    <section>
      <div className="sechead">
        <h2>Scorecard <small>{P.label}, {dfmt(P.start)} to {dfmt(P.end)}, against the same dates last year. Color only comes from the goal.</small> <SecHelp k="scorecard" /></h2>
        <Seg label="Period" value={per} options={PER} onChange={setPer} />
      </div>
      <div className="tbl"><table>
        <thead><tr><th>Metric</th><th className="r">{P.label}</th><th className="r">Last year</th><th className="r">Change</th><th className="r">Goal</th><th>Pacing</th></tr></thead>
        <tbody>
          {b.rows.map((r: any) => {
            const g = rowGoal(s, r, per);
            let goalCell: React.ReactNode = <span className="sub">–</span>, paceCell: React.ReactNode = null;
            if (g && g.rate) {
              goalCell = r.fmt === "money" ? money(g.goal) : pct(g.goal, 0);
              const st = goalClass(rv(r, r.values[per]), g.goal);
              if (st) paceCell = <GoalChip state={st}>{goalWord(st)}</GoalChip>;
            } else if (g) {
              goalCell = <>{r.fmt === "money" ? money(g.goal) : n0(g.goal)}{g.target != null && per !== "week" ? <div className="sub">pace {r.fmt === "money" ? money(g.target) : n0(g.target)}</div> : null}</>;
              paceCell = <PaceBar pacing={g.pacing} />;
            } else paceCell = <span className="sub">No goal for this period on the goals sheet</span>;
            return (
              <tr key={r.metric}>
                <td className="m">{metricName(r.metric)}{r.owner ? <span className="owner">{r.owner}</span> : null}{r.window ? <div><Win>last {r.window.days} days</Win> <span className="sub">{dfmt(r.window.start)} to {dfmt(r.window.end)}</span></div> : null}</td>
                <td className="r num"><FmtVal r={r} v={r.values[per]} /></td>
                <td className="r num"><FmtVal r={r} v={r.ly[per]} /></td>
                <td className="r"><Chg r={r} cur={r.values[per]} ly={r.ly[per]} /></td>
                <td className="r num">{goalCell}</td>
                <td>{paceCell}</td>
              </tr>
            );
          })}
          {extra.map((r: any) => (
            <tr key={r.metric}>
              <td className="m">{metricName(r.metric)}{r.owner ? <span className="owner">{r.owner}</span> : null}<div><Win>quarter to date</Win></div></td>
              <td className="r num">{r.qtd == null ? "–" : <FmtVal r={r} v={r.qtd} />}</td>
              <td className="r sub">–</td><td />
              <td className="r num">{r.q_goal == null ? "–" : r.fmt === "money" ? money(r.q_goal) : n0(r.q_goal)}</td>
              <td><span className="sub">{r.qtd == null ? "Not filled in on the goals sheet yet" : "Quarter to date, from the goals sheet"}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="sub">Goals come from the goals sheet: weekly and quarterly goals, plus the original yearly sales goal. Green is at or above the goal or pace, amber is close, red is behind. Close rate is demos signed in the window divided by demos held in it (the scoreboard rule), always the last 30 days.</p>
    </section>
  );
}

// ---------- multi-year comparison from daily history ----------
const dayDate = (y: number, i: number) => new Date(Date.UTC(y, 0, 1 + i));
function isoWY(dt: Date): [number, number] {
  const d = new Date(dt.getTime()); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = Date.UTC(d.getUTCFullYear(), 0, 1);
  return [d.getUTCFullYear(), Math.ceil(((d.getTime() - ys) / 864e5 + 1) / 7)];
}
function histSeries(s: any, key: string, mode: string): YearSeries {
  const H = s.history, years: number[] = H.years, M = H.metrics[key] || {};
  const [ay, am, ad] = H.as_of.split("-").map(Number);
  const asOf = Date.UTC(ay, am - 1, ad);
  const out: Record<number, [number, number][]> = {};
  if (mode === "week") {
    const buckets: Record<number, Record<number, number>> = {};
    years.forEach((y) => (M[String(y)] || []).forEach((v: number, i: number) => { const [wy, wk] = isoWY(dayDate(y, i)); (buckets[wy] = buckets[wy] || {})[wk] = (buckets[wy][wk] || 0) + v; }));
    years.forEach((y) => {
      const b = buckets[y] || {}; const pts: [number, number][] = [];
      for (let w = 1; w <= 53; w++) {
        if (b[w] == null) continue;
        const jan4 = Date.UTC(y, 0, 4), d4 = new Date(jan4).getUTCDay() || 7, mon1 = jan4 - (d4 - 1) * 864e5;
        const sun = mon1 + ((w - 1) * 7 + 6) * 864e5;
        if (sun > asOf) continue;
        if (y === years[0] && w > 50 && new Date(sun).getUTCFullYear() !== y) continue;
        pts.push([w, b[w]]);
      }
      out[y] = pts;
    });
    return { series: out, xMax: 53, ticks: [1, 14, 27, 40, 52].map((w) => ({ x: w, label: "Wk " + w })) };
  }
  if (mode === "month") {
    years.forEach((y) => {
      const sums = Array(12).fill(0), seen = Array(12).fill(false);
      (M[String(y)] || []).forEach((v: number, i: number) => { const m = dayDate(y, i).getUTCMonth(); sums[m] += v; seen[m] = true; });
      out[y] = sums.map((v, m) => (seen[m] ? [m + 1, v] : null)).filter(Boolean) as [number, number][];
    });
    return { series: out, xMax: 12, ticks: MON.map((m, i) => ({ x: i + 1, label: m })).filter((_, i) => i % 2 === 0) };
  }
  if (mode === "quarter") {
    const qi = Math.floor((am - 1) / 3);
    years.forEach((y) => {
      const qs = Date.UTC(y, qi * 3, 1), qe = Date.UTC(y, qi * 3 + 3, 0); let run = 0; const pts: [number, number][] = [];
      (M[String(y)] || []).forEach((v: number, i: number) => { const t = dayDate(y, i).getTime(); if (t < qs || t > qe) return; run += v; pts.push([Math.round((t - qs) / 864e5) + 1, run]); });
      if (pts.length) out[y] = pts;
    });
    const qs = Date.UTC(ay, qi * 3, 1);
    return { series: out, xMax: 92, quarter: qi + 1, ticks: [0, 1, 2].map((k) => ({ x: Math.round((Date.UTC(ay, qi * 3 + k, 1) - qs) / 864e5) + 1, label: MON[qi * 3 + k] })) };
  }
  years.forEach((y) => { let run = 0; out[y] = (M[String(y)] || []).map((v: number, i: number) => ((run += v), [i + 1, run] as [number, number])); });
  return { series: out, xMax: 366, ticks: [0, 3, 6, 9].map((m) => ({ x: Math.round((Date.UTC(2025, m, 1) - Date.UTC(2025, 0, 1)) / 864e5) + 1, label: MON[m] })) };
}

const ITEMS: [string, string, (v: any) => string][] = [["Sales", "sales", money], ["Revenue", "revenue", money], ["Jobs sold", "jobs_sold", n0], ["Appointments", "appointments", n0], ["Sits", "sits", n0], ["Leads", "leads", n0]];

function Compare({ s }: { s: any }) {
  const [mvm, setMvm] = usePersist("mvm", "sales", ITEMS.map((i) => i[1]));
  const [mode, setMode] = usePersist("cmp", "quarter", ["week", "month", "quarter", "year"]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  if (!s.history) return null;
  const [label, key, fmt] = ITEMS.find((i) => i[1] === mvm) || ITEMS[0];
  const H = s.history, years: number[] = H.years, cur = years[years.length - 1], last = cur - 1;
  const data = histSeries(s, key, mode);
  const ser = data.series;
  const at = (y: number, x: number) => { let v: number | null = null; (ser[y] || []).forEach((p) => { if (p[0] <= x) v = p[1]; }); return v; };
  const curPts = ser[cur] || [], lastX = curPts.length ? curPts[curPts.length - 1][0] : null;
  const sumX = (y: number, a: number, b: number) => (ser[y] || []).filter((p) => p[0] >= a && p[0] <= b).reduce((t, p) => t + p[1], 0);
  const chip = (a: number | null, b: number | null) => (b ? <span className="chg">{a! >= b ? "Up" : "Down"} {pct(Math.abs((a! - b) / b), 0)}</span> : null);
  const best = () => Object.keys(ser).map(Number).filter((y) => y !== cur && ser[y].length).map((y) => [y, ser[y][ser[y].length - 1][1]]).sort((p, q) => q[1] - p[1])[0];
  let facts: [string, string, React.ReactNode][] = [], title = "", sub = "";
  if (mode === "week") {
    title = `${label} by week`; sub = "Each line is one year, Monday to Sunday weeks numbered through the year";
    const a = lastX ? at(cur, lastX) : null, b = lastX ? (ser[last] || []).find((p) => p[0] === lastX) : null;
    facts = [[`Week ${lastX} this year`, fmt(a), ""], [`Week ${lastX} last year`, fmt(b ? b[1] : null), chip(a, b ? b[1] : 0)], ["Next 4 weeks last year", fmt(sumX(last, (lastX ?? 0) + 1, (lastX ?? 0) + 4)), "What came next last year"]];
  } else if (mode === "month") {
    title = `${label} by month`; sub = "Each line is one year. This month is only partway done";
    const a = lastX ? at(cur, lastX) : null, b = lastX ? (ser[last] || []).find((p) => p[0] === lastX) : null;
    facts = [[`${MON[(lastX ?? 1) - 1]} so far`, fmt(a), ""], [`${MON[(lastX ?? 1) - 1]} last year, whole month`, fmt(b ? b[1] : null), ""], [`${MON[(lastX ?? 0) % 12]} last year`, fmt(((ser[last] || []).find((p) => p[0] === (lastX ?? 0) + 1) || [])[1]), "Next month, last year"]];
  } else {
    const q = mode === "quarter";
    title = q ? `Q${data.quarter} ${label.toLowerCase()} by year` : `${label} by year`;
    sub = q ? "Running total from the first day of the quarter" : "Running total from January 1";
    const a = lastX ? at(cur, lastX) : 0, b = lastX ? at(last, lastX) : 0;
    const full = (ser[last] || []).length ? ser[last][ser[last].length - 1][1] : null;
    const bst = best();
    facts = q
      ? [[`Q${data.quarter} ${cur}, day ${lastX}`, fmt(a), ""], [`Q${data.quarter} ${last}, day ${lastX}`, fmt(b), chip(a, b)], [`All of Q${data.quarter} ${last}`, fmt(full), bst ? `Best Q${data.quarter}: ${bst[0]}, ${fmt(bst[1])}` : ""]]
      : [[`${cur} so far`, fmt(a), ""], [`${last} at the same point`, fmt(b), chip(a, b)], [`All of ${last}`, fmt(full), bst ? `Best year: ${bst[0]}, ${fmt(bst[1])}` : ""]];
  }
  const toggle = (y: number) => setHidden((h) => { const n = new Set(h); n.has(y) ? n.delete(y) : n.add(y); return n; });
  return (
    <section>
      <div className="sechead">
        <h2>{title} <small>{sub}</small> <SecHelp k="compare" /></h2>
        <div className="seg-row">
          <Seg label="Compare by" value={mode} options={PER} onChange={setMode} />
          <Seg label="Metric" value={key} options={ITEMS.map((i) => [i[1], i[0]] as [string, string])} onChange={setMvm} />
        </div>
      </div>
      <div className="mvm">
        <div>
          <LineChart data={data} fmt={fmt === money ? moneyK : fmt} curYear={cur} lastYear={last} hidden={hidden} cutX={mode === "week" || mode === "month" ? null : lastX} />
          <div className="legend" role="group" aria-label="Years shown">
            {years.slice().reverse().map((y) => (
              <button key={y} type="button" className="yr" aria-pressed={!hidden.has(y)} onClick={() => toggle(y)}>
                <YearSwatch y={y} curYear={cur} lastYear={last} years={Object.keys(data.series).map(Number)} />{y}
              </button>
            ))}
            <span className="sub">Tap a year to hide or show it</span>
          </div>
        </div>
        <div className="facts">
          {facts.map(([l, v, x], i) => (<div key={i}><span className="label">{l}</span><span className="big num">{v}</span>{x ? <span className="sub">{x}</span> : null}</div>))}
        </div>
      </div>
      <p className="explain">Data goes back to {dfmt(H.first_record)} {H.first_record.slice(0, 4)}, so full years start in {years[0]}. How leads were logged may have changed over the years, so check with leadership before reading too much into older lead counts.</p>
    </section>
  );
}

function Trend({ s }: { s: any }) {
  const [mode, setMode] = usePersist("trend", "weekly", ["weekly", "monthly"]);
  const monthly = mode === "monthly" && s.months?.length;
  const series: any[] = monthly ? s.months : s.trend;
  if (!series?.length) return null;
  const labels = series.map((x) => (monthly ? mlabel(x.month) : dfmt(x.week)));
  return (
    <section>
      <div className="sechead">
        <h2>{monthly ? "13-month trend" : "13-week trend"} <SecHelp k="trend" /></h2>
        <Seg label="Trend period" value={monthly ? "monthly" : "weekly"} options={[["weekly", "Weekly"], ["monthly", "Monthly"]]} onChange={setMode} />
      </div>
      <p className="sub">{monthly ? "Calendar months. The solid bar is the last full month, the outlined bar is this month so far." : "Weeks run Monday to Sunday. The solid bar is last week."}</p>
      <div className="trend">
        {ITEMS.map(([label, key, fmt]) => {
          const vals = series.map((x) => x[key] || 0);
          const st = barStats(vals, !!monthly);
          const hiItem = series[st.hiIdx];
          return (
            <div key={key}>
              <div className="head"><span className="label">{label}{monthly ? " · " + mlabel(hiItem.month) : ""}</span><span className="val num">{fmt(st.hi)}</span></div>
              <Bars vals={vals} labels={labels} fmt={fmt} partialLast={!!monthly} unit={monthly ? "month" : "week"} title={label} />
              <span className="sub">
                {monthly
                  ? `${mlabel(hiItem.month)} vs ${series.length - 2}-month average of ${sayS(fmt, st.avg)} (red line). ${mlabel(series[series.length - 1].month)} so far: ${sayS(fmt, st.partial)}`
                  : `Last week vs 12-week average of ${sayS(fmt, st.avg)} (red line)`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** When Claude wrote a block of text, and a note when the numbers have moved on since (`note` says where they are). */
function Written({ at, dataAt, note }: { at?: string; dataAt?: string; note?: string }) {
  if (!at) return null;
  const behind = note && dataAt && Date.parse(dataAt) - Date.parse(at) > 3 * 36e5;
  return <span className="written">{written(at)}{behind ? `. ${note}` : ""}</span>;
}

export function Priorities({ p, at, dataAt }: { p: any[]; at?: string; dataAt?: string }) {
  if (!p?.length) return null;
  return (
    <section>
      <h2>Priorities <small>What to get ahead of, ranked. Each one comes from a number on the Pulse.</small> <SecHelp k="priorities" /></h2>
      <Written at={at} dataAt={dataAt} note="The tiles above update every hour, so their numbers can differ from these lines." />
      <div className="pri boxed">
        {p.map((x, i) => (
          <div key={i}>
            <div className="top"><h3>{tidy(x.title)}</h3><span className="n">{i + 1}</span></div>
            {x.owner ? <span className="owner">Owner: {x.owner}</span> : null}
            <p className="why">{tidy(x.why)}</p>
            {x.first_step ? <p className="step"><b>First step</b>{tidy(x.first_step)}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Notes({ c }: { c: any }) {
  const wk: string[] = c?.worth_knowing || [], rz: any[] = c?.raise_this_week || [];
  return (
    <div className="two">
      <section><h2>Worth knowing <SecHelp k="notes" /></h2><Written at={c?.generated_at} />{wk.length ? <ul className="notes">{wk.map((t, i) => <li key={i}>{tidy(t, { noEmoji: true })}</li>)}</ul> : <div className="empty-note">Nothing stood out this week.</div>}</section>
      <section><h2>Raise this week <SecHelp k="raise" /></h2><Written at={c?.generated_at} />{rz.length ? <ul className="notes">{rz.map((t, i) => <li key={i}><span className="who">{t.who}</span>{tidy(t.question)}</li>)}</ul> : <div className="empty-note">No questions queued for this week.</div>}</section>
    </div>
  );
}

export function Team({ c, repSlugs, week, dataAt }: { c: any; repSlugs: Record<string, string>; week: string; dataAt?: string }) {
  const t: any[] = c?.team || [];
  if (!t.length) return null;
  return (
    <section id="team">
      <h2>This week for each person <small>One thing to remember, one win, one thing to sharpen. Reps see only their own card.</small> <SecHelp k="team" /></h2>
      <Written at={c?.generated_at} dataAt={dataAt} note="The numbers on the Pulse update every hour, so they can differ from these lines." />
      <div className="pri team">
        {t.map((p, i) => (
          <div key={i}>
            <div className="top">
              <h3>{repSlugs[p.who] ? <Link href={`/pulse/hq/rep/${repSlugs[p.who]}${week ? `?week=${week}` : ""}`}>{p.who}</Link> : p.who}</h3>
              {p.role ? <span className="owner">{p.role}</span> : null}
            </div>
            <p className="step"><b>Takeaway</b>{tidy(p.takeaway)}</p>
            <p className="why"><b className="tag">Doing well</b>{tidy(p.win)}</p>
            <p className="why"><b className="tag">Next level</b>{tidy(p.improve)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CloseAndReps({ s, repSlugs, week }: { s: any; repSlugs: Record<string, string>; week: string }) {
  const o: any[] = s.outside_team || [];
  const sits = o.reduce((a, x) => a + x.sits, 0), sold = o.reduce((a, x) => a + x.sold, 0);
  return (
    <div className="two" id="reps">
      <section>
        <h2>Close rate <small>Demos signed in the window divided by demos held in it</small> <SecHelp k="close" /></h2>
        <div className="tbl"><table>
          <thead><tr><th>Window</th><th className="r">Sales team</th><th className="r">Company</th></tr></thead>
          <tbody>{(s.close_windows || []).map((w: any) => (
            <tr key={w.days}><td className="m">{w.days} days<div className="sub">{dfmt(w.start)} to {dfmt(w.end)}</div></td><td className="r num"><RateTxt r={w.team} /></td><td className="r num"><RateTxt r={w.company} /></td></tr>
          ))}</tbody>
        </table></div>
        {o.length ? <p className="explain"><b>Sales team</b> is the {(s.reps || []).length} reps on the roster. <b>Company</b> also counts quoted appointments run by anyone else. Last 90 days that added {n0(sits)} sits and {n0(sold)} sales: {o.map((x) => `${x.who} ${x.sold} of ${x.sits}`).join(", ")}.</p> : null}
      </section>
      <section>
        <h2>Reps <small>Sales team. Tap a name for their screen.</small> <SecHelp k="reps" /></h2>
        <div className="wins"><Win>close rate: last 30 days</Win><Win>jobs, sales, avg ticket: last 90 days</Win></div>
        <div className="tbl"><table>
          <thead><tr><th>Rep</th><th className="r">Close rate</th><th className="r">Jobs</th><th className="r">Sales</th><th className="r">Avg ticket</th></tr></thead>
          <tbody>{(s.reps || []).map((r: any) => (
            <tr key={r.rep}>
              <td className="m">{repSlugs[r.rep] ? <Link href={`/pulse/hq/rep/${repSlugs[r.rep]}${week ? `?week=${week}` : ""}`}>{r.rep}</Link> : r.rep}</td>
              <td className="r num"><RateTxt r={r.close_30 ?? r.close} /></td><td className="r num">{n0(r.jobs_sold)}</td><td className="r num">{money(r.sales)}</td><td className="r num">{money(r.avg_ticket)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  );
}

function Upgrades({ s }: { s: any }) {
  const u = s.upgrades; if (!u) return null;
  const map: Record<string, any> = {};
  (u.ytd || []).forEach((r: any) => (map[r.who] = { who: r.who, ytd: r }));
  (u.qtd || []).forEach((r: any) => ((map[r.who] = map[r.who] || { who: r.who }).qtd = r));
  const rows = Object.values(map).sort((a: any, b: any) => (b.ytd?.amount || 0) - (a.ytd?.amount || 0));
  const yr = (s.as_of || "").slice(0, 4);
  return (
    <section>
      <h3 className="h3">Upgrades <small>Upsells and change orders, counted when installed. Who sold them.</small></h3>
      <div className="tri">
        <div><span className="label">{yr} so far</span><span className="big num">{money(u.ytd_total)}</span></div>
        <div><span className="label">Same point last year</span><span className="big num">{money(u.last_year_same_point)}</span></div>
        <div><span className="label">All of last year</span><span className="big num">{money(u.last_year_total)}</span></div>
      </div>
      <div className="tbl"><table>
        <thead><tr><th>Sold by</th><th className="r">{s.quarter.label} so far</th><th className="r">{yr} so far</th></tr></thead>
        <tbody>{rows.length ? rows.map((r: any) => (
          <tr key={r.who}><td className="m">{r.who}</td><td className="r num">{r.qtd ? <>{money(r.qtd.amount)} <span className="sub">({r.qtd.count})</span></> : "–"}</td><td className="r num">{r.ytd ? <>{money(r.ytd.amount)} <span className="sub">({r.ytd.count})</span></> : "–"}</td></tr>
        )) : <tr><td colSpan={3} className="sub">No upgrades installed yet.</td></tr>}</tbody>
      </table></div>
    </section>
  );
}

export function Marketing({ s }: { s: any }) {
  const m = s.marketing; if (!m?.leads_by_source) return null;
  const ms: string[] = m.months || [];
  const max = Math.max(1, ...m.leads_by_source.flatMap((r: any) => ms.map((k) => r.by_month[k] || 0)));
  const sp = m.spend;
  const sheet = SPEND_SHEET ? <a href={SPEND_SHEET} target="_blank" rel="noopener noreferrer">marketing spend</a> : <>marketing spend</>;
  return (
    <section id="marketing">
      <h2>Marketing <small>Leads by source by month. Pair this with the lead sources table below for what each source turns into.</small> <SecHelp k="marketing" /></h2>
      <div className="tbl"><table>
        <thead><tr><th>Source</th>{ms.map((k, i) => <th key={k} className="r">{mlabel(k)}{i === ms.length - 1 && m.partial_last ? " so far" : ""}</th>)}</tr></thead>
        <tbody>{m.leads_by_source.map((r: any) => (
          <tr key={r.source}><td className="m">{r.source}</td>{ms.map((k) => {
            const v = r.by_month[k] || 0, a = 0.08 + (0.5 * v) / max;
            return <td key={k} className="heat num"><span style={{ background: `color-mix(in srgb, var(--bar-hi) ${Math.round(a * 100)}%, transparent)`, color: v / max > 0.55 ? "var(--bg)" : "var(--fg)" }}>{v || "–"}</span></td>;
          })}</tr>
        ))}</tbody>
      </table></div>
      {!sp?.lines?.length ? (
        <p className="explain">{CRM} has no ad spend. Fill in the {sheet} sheet and cost per lead and cost per sold job show up here within the hour.</p>
      ) : (
        <>
          <h3 className="h3">Cost by source</h3>
          <p className="sub">Months with spend entered so far: {sp.months.map((x: string) => mlabel(x + "-01", true)).join(", ")}. {sp.note}</p>
          <div className="tbl"><table>
            <thead><tr><th>Spend line</th><th className="r">Spend</th><th className="r">Leads</th><th className="r">Per lead</th><th className="r">Jobs sold</th><th className="r">Per sold job</th><th className="r">Sales</th><th className="r">Sales per $1</th></tr></thead>
            <tbody>{sp.lines.map((o: any) => (
              <tr key={o.line}>
                <td className="m">{o.line}{o.mapped ? null : <span className="sub"> (not tied to a lead source)</span>}</td>
                <td className="r num">{money(o.spend)}</td><td className="r num">{o.mapped ? n0(o.leads) : "–"}</td><td className="r num">{money(o.cost_per_lead)}</td>
                <td className="r num">{o.mapped ? n0(o.sold) : "–"}</td><td className="r num">{money(o.cost_per_sold_job)}</td><td className="r num">{o.mapped ? money(o.sales) : "–"}</td>
                <td className="r num">{o.sales_per_dollar == null ? "–" : "$" + o.sales_per_dollar.toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="explain">Spend comes from the {sheet} sheet. Months or vendors left blank there are not counted yet, so treat this as a partial read until every month is filled in.</p>
        </>
      )}
    </section>
  );
}

export function Sources({ s }: { s: any }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const Cells = ({ r }: { r: any }) => (
    <>
      <td className="r num">{n0(r.leads)}</td>
      <td className="r num">{n0(r.appointments)}<div className="sub">{pct(r.booking?.pct, 0)} booked</div></td>
      <td className="r num"><RateTxt r={r.close} /></td><td className="r num">{n0(r.jobs_sold)}</td><td className="r num">{money(r.sales)}</td>
      <td className="r num">{r.leads ? money(r.sales / r.leads) : "–"}</td>
    </>
  );
  return (
    <section id="sources">
      <h2>Lead sources <small>Sorted by sales. Tap a source to see what is inside it. Demo conversion: demos held that signed, company-wide.</small> <SecHelp k="sources" /></h2>
      <div className="wins"><Win>last 90 days</Win></div>
      <div className="tbl"><table>
        <thead><tr><th>Source</th><th className="r">Leads</th><th className="r">Appointments</th><th className="r">Demo conv.</th><th className="r">Jobs sold</th><th className="r">Sales</th><th className="r">Sales per lead</th></tr></thead>
        <tbody>{(s.sources || []).map((r: any) => {
          const has = r.subs?.length, isOpen = has && open.has(r.source);
          return [
            <tr key={r.source}>
              <td className="m">{has ? <button type="button" className="exp" aria-expanded={!!isOpen} onClick={() => setOpen((o) => { const n = new Set(o); n.has(r.source) ? n.delete(r.source) : n.add(r.source); return n; })}>{r.source}</button> : <span style={{ paddingLeft: 18 }}>{r.source}</span>}</td>
              <Cells r={r} />
            </tr>,
            ...(isOpen ? r.subs.map((u: any) => <tr key={r.source + "/" + u.source} className="subrow"><td className="m">{u.source}</td><Cells r={u} /></tr>) : []),
          ];
        })}</tbody>
      </table></div>
    </section>
  );
}

const RecLink = ({ rr, url }: { rr?: string | null; url?: string | null }) =>
  url ? <a href={url} target="_blank" rel="noopener noreferrer">{rr || "Open"}</a> : <>{rr || ""}</>;

function Installs({ s }: { s: any }) {
  const i = s.installs; if (!i) return null;
  const total = (i.installed_total || 0) + (i.to_install_total || 0);
  return (
    <section>
      <h3 className="h3">Installs this week <small>{dfmt(i.week_start)} to {dfmt(i.week_end)}, as of {dfmt(s.as_of)}</small></h3>
      <div className="tri">
        <div><span className="label">Installed so far</span><span className="big num">{money(i.installed_total)}</span><span className="sub">{(i.installed || []).length} records</span></div>
        <div><span className="label">Still to install</span><span className="big num">{money(i.to_install_total)}</span><span className="sub">{(i.to_install || []).length} jobs</span></div>
        <div><span className="label">Week total</span><span className="big num">{money(total)}</span><span className="sub">{money(i.finishing_this_quarter)} scheduled to finish this quarter ({n0(i.finishing_this_quarter_jobs)} jobs)</span></div>
      </div>
      {(i.at_risk || []).length ? <div className="risk"><strong>At risk this week:</strong> {i.at_risk.map((r: any, k: number) => <span key={k}>{k ? "; " : ""}<RecLink rr={r.rr} url={r.url} /> ({r.status}, crew {dfmt(r.date)}, {money(r.value)})</span>)}</div> : null}
      {i.past_date_still_approved ? <div className="risk"><strong>{i.past_date_still_approved}</strong> scheduled job(s) are past their crew date and still not marked complete.</div> : null}
      <details><summary>Still to install <span className="c">{(i.to_install || []).length} jobs</span></summary><div className="tbl"><table>
        <thead><tr><th>Record</th><th>Rep</th><th>Trades</th><th>Crew date</th><th>Status</th><th className="r">Job value</th></tr></thead>
        <tbody>{(i.to_install || []).length ? i.to_install.map((r: any) => <tr key={r.rr}><td><RecLink rr={r.rr} url={r.url} /></td><td>{r.rep}</td><td>{r.trades}</td><td className="num">{dfmt(r.date)}</td><td>{r.status}</td><td className="r num">{money(r.value)}</td></tr>) : <tr><td colSpan={6} className="sub">Nothing else on the calendar this week.</td></tr>}</tbody>
      </table></div></details>
      <details><summary>Installed so far <span className="c">{(i.installed || []).length} records</span></summary><div className="tbl"><table>
        <thead><tr><th>Record</th><th>Rep</th><th>Trade</th><th>Work type</th><th>Installed</th><th className="r">Amount</th></tr></thead>
        <tbody>{(i.installed || []).length ? i.installed.map((r: any, k: number) => <tr key={k}><td><RecLink rr={r.rr} url={r.url} /></td><td>{r.rep}</td><td>{r.trade}</td><td>{r.work_type}</td><td className="num">{dfmt(r.date)}</td><td className="r num">{money(r.amount)}</td></tr>) : <tr><td colSpan={6} className="sub">Nothing marked installed yet this week.</td></tr>}</tbody>
      </table></div></details>
    </section>
  );
}

const PROD_PER: [string, string][] = [["last_week", "Last week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]];
const ym = (iso: string) => iso.slice(0, 7);

/** Pick any month: a year at a time, every month showing its revenue installed. Brighter is a bigger month. */
function MonthPicker({ months, value, onPick, onClose }: { months: any[]; value: string; onPick: (k: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const byKey: Record<string, any> = Object.fromEntries(months.map((m) => [ym(m.start), m]));
  const years = Array.from(new Set(months.map((m) => +m.start.slice(0, 4))));
  const [yr, setYr] = useState(+value.slice(0, 4));
  const max = Math.max(1, ...months.filter((m) => !m.partial).map((m) => m.cur.revenue || 0));
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const click = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.(".prod-seg, .linkbtn") && onClose();
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [onClose]);
  return (
    <div className="mpick" ref={box} role="dialog" aria-label="Pick a month">
      <div className="mp-head">
        <button type="button" onClick={() => setYr(yr - 1)} disabled={yr <= years[0]} aria-label="Year before">‹</button>
        <span className="num">{yr}</span>
        <button type="button" onClick={() => setYr(yr + 1)} disabled={yr >= years[years.length - 1]} aria-label="Year after">›</button>
      </div>
      <div className="mp-grid">
        {MON.map((name, i) => {
          const k = `${yr}-${String(i + 1).padStart(2, "0")}`, m = byKey[k];
          const heat = m ? Math.min(1, (m.cur.revenue || 0) / max) : 0;
          return (
            <button key={k} type="button" disabled={!m} aria-pressed={k === value} onClick={() => onPick(k)}
              style={{ ["--heat" as any]: heat.toFixed(2) }} title={m ? `${name} ${yr}: ${money(m.cur.revenue)} installed, ${n0(m.cur.jobs_installed)} jobs` : undefined}>
              <span className="mn">{name}</span>
              <span className="mv num">{m ? moneyK(m.cur.revenue) : "–"}</span>
              <span className="mj">{m ? `${n0(m.cur.jobs_installed)} jobs${m.partial ? " so far" : ""}` : ""}</span>
            </button>
          );
        })}
      </div>
      <p className="sub">Revenue installed each month. Brighter is a bigger month. Pick one to see it.</p>
    </div>
  );
}

export function Production({ s }: { s: any }) {
  const [per, setPer] = usePersist("prodPer", "quarter", PROD_PER.map((p) => p[0]));
  const [mode, setMode] = usePersist("prodTrend", "weekly", ["weekly", "monthly"]);
  const [pick, setPick] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [allMonths, setAllMonths] = useState(false);
  const top = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const p = s.production; if (!p) return null;
  const months: any[] = p.months ?? p.monthly;
  const thisMonth = ym(s.as_of);
  const sel = per === "month" ? pick ?? thisMonth : null;
  const M = sel && sel !== thisMonth ? months.find((m) => ym(m.start) === sel) : null;
  const lyOf = (iso: string) => `${+iso.slice(0, 4) - 1}${iso.slice(4)}`;
  const P = M ? { label: mlabel(M.start, true), start: M.start, end: M.end, ly_start: M.ly_start ?? lyOf(M.start), ly_end: M.ly_end ?? lyOf(M.end), cur: M.cur, ly: M.ly, cycle: M.cycle } : p.periods[per];
  const gpBy: Record<string, any> = Object.fromEntries((s.costs?.monthly ?? []).map((r: any) => [r.month, r]));
  const goalGP = s.costs?.goal;
  const gpSel = sel ? gpBy[sel] : null;
  const boardPer = per === "last_week" ? "week" : per;
  const rev = s.board?.rows.find((r: any) => r.metric === "Revenue");
  const upg = s.board?.rows.find((r: any) => r.metric === "Upgrades");
  const gRev = rev && !M ? rowGoal(s, rev, boardPer) : null, gUpg = upg && !M ? rowGoal(s, upg, boardPer) : null;
  const series: any[] = mode === "monthly" ? p.monthly : p.weekly;
  const labels = series.map((x) => (mode === "monthly" ? mlabel(x.start) : dfmt(x.start)));
  const chart = (key: string, label: string, fmt: (v: any) => string) => {
    const vals = series.map((x) => x.cur[key] || 0), ly = series.map((x) => x.ly[key] || 0);
    const st = barStats(vals, true);
    return (
      <div key={key}>
        <div className="head"><span className="label">{label}</span><span className="val num">{fmt(st.hi)}</span></div>
        <Bars vals={vals} ly={ly} labels={labels} fmt={fmt} partialLast unit={mode === "monthly" ? "month" : "week"} title={label} />
        <span className="sub">Last full {mode === "monthly" ? "month" : "week"} vs {st.n}-{mode === "monthly" ? "month" : "week"} average of {sayS(fmt, st.avg)} (red line). Gray behind is last year.</span>
      </div>
    );
  };
  const choose = (k: string) => {
    if (k === "month") { setPer("month"); setOpen(per === "month" ? !open : true); return; }
    setPer(k); setOpen(false);
  };
  const openMonth = (k: string) => {
    setPer("month"); setPick(k === thisMonth ? null : k); setOpen(false);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const segOpts: [string, string][] = PROD_PER.map(([k, l]) => [k, k === "month" ? `${sel && sel !== thisMonth ? mlabel(sel + "-01", true) : "This month"} ▾` : l]);
  const cyc = P.cycle || {};
  const table = months.slice().reverse().slice(0, allMonths ? undefined : 12);
  return (
    <section id="production" ref={top}>
      <div className="sechead">
        <h2>Production <small>Getting sold work installed and completed: revenue and jobs installed, time from sold to installed, and upgrades.</small> <SecHelp k="production" /></h2>
        <div className="prod-seg">
          <Seg label="Production period" value={per} options={segOpts} onChange={choose} />
        </div>
      </div>
      {open ? <MonthPicker months={months} value={sel ?? thisMonth} onPick={openMonth} onClose={close} /> : null}
      <div className="sub">{M ? `${P.label}${M.partial ? " so far" : ""}` : P.label}: {dfmt(P.start)} to {dfmt(P.end)} · last year {dfmt(P.ly_start)} to {dfmt(P.ly_end)}{per === "month" ? <> · <button type="button" className="linkbtn" onClick={() => setOpen(true)}>Pick another month</button></> : null}</div>
      <div className="strip">
        <div><span className="label">Revenue installed</span><span className="big num">{moneyK(P.cur.revenue)}</span>
          {gRev?.pacing != null ? <span className="goal"><GoalChip state={paceClass(gRev.pacing)}>{pct(gRev.pacing, 0)} of pace</GoalChip> goal {moneyK(gRev.goal)}</span> : null}
          {gpSel?.gp != null ? <span className="goal"><GoalChip state={goalClass(gpSel.gp, goalGP)}>GP {gpSel.gp.toFixed(1)}%</GoalChip> on {n0(gpSel.jobs)} closed jobs, goal {goalGP}%</span> : null}
          <span className="vsly"><ChangeChip a={P.cur.revenue} b={P.ly.revenue} /> vs {moneyK(P.ly.revenue)} last year</span></div>
        <div><span className="label">Jobs installed</span><span className="big num">{n0(P.cur.jobs_installed)}</span>
          <span className="vsly"><ChangeChip a={P.cur.jobs_installed} b={P.ly.jobs_installed} /> vs {n0(P.ly.jobs_installed)} last year</span></div>
        <div><span className="label">Days sold to installed</span><span className="big num">{cyc.n ? n0(cyc.median) : "–"}</span>
          <span className="sub">{cyc.n ? <>Median of {n0(cyc.n)} jobs. Average {n1(cyc.average)}, slowest quarter of jobs {n0(cyc.p75)}+ days.</> : "No installs in this period yet."}</span></div>
        <div><span className="label">Upgrades</span><span className="big num">{moneyK(P.cur.upgrades)}</span>
          {gUpg?.pacing != null ? <span className="goal"><GoalChip state={paceClass(gUpg.pacing)}>{pct(gUpg.pacing, 0)} of pace</GoalChip> goal {moneyK(gUpg.goal)}</span> : null}
          <span className="vsly"><ChangeChip a={P.cur.upgrades} b={P.ly.upgrades} /> vs {moneyK(P.ly.upgrades)} last year · {n0(P.cur.upgrades_count)} upgrades</span></div>
      </div>
      <div className="sechead">
        <span className="label">Installs by {mode === "monthly" ? "month" : "week"}</span>
        <Seg label="Production trend" value={mode} options={[["weekly", "Weekly"], ["monthly", "Monthly"]]} onChange={setMode} />
      </div>
      <div className="trend">
        {chart("revenue", "Revenue installed", money)}
        {chart("jobs_installed", "Jobs installed", n0)}
        {chart("upgrades", "Upgrades", money)}
      </div>
      <div className="sechead">
        <span className="label">Month by month <span className="sub">Tap a month to open it above.</span></span>
      </div>
      <div className="tbl"><table className="months">
        <thead><tr><th>Installed in</th><th className="r">Revenue installed</th><th className="r">vs last year</th><th className="r">Jobs</th><th className="r">Upgrades</th><th className="r">Days sold to installed</th><th className="r">GP</th></tr></thead>
        <tbody>{table.map((m: any) => {
          const k = ym(m.start), g = gpBy[k];
          return (
            <tr key={k} className={`pick${k === sel ? " on" : ""}`} onClick={() => openMonth(k)}>
              <td className="m"><button type="button" className="linkbtn" onClick={(e) => { e.stopPropagation(); openMonth(k); }}>{mlabel(m.start, true)}</button>{m.partial ? <span className="sub"> so far</span> : null}</td>
              <td className="r num">{money(m.cur.revenue)}</td>
              <td className="r"><ChangeChip a={m.cur.revenue} b={m.ly.revenue} /></td>
              <td className="r num">{n0(m.cur.jobs_installed)}</td>
              <td className="r num">{m.cur.upgrades ? money(m.cur.upgrades) : "–"}</td>
              <td className="r num">{m.cycle?.n ? n0(m.cycle.median) : "–"}</td>
              <td className={`r num ${g?.gp != null ? goalClass(g.gp, goalGP) : ""}`}>{g?.gp != null ? `${g.gp.toFixed(1)}%` : "–"}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
      {months.length > 12 ? <button type="button" className="btn" onClick={() => setAllMonths(!allMonths)}>{allMonths ? "Show the last 12 months" : `Show all ${months.length} months, back to ${mlabel(months[0].start, true)}`}</button> : null}
      <p className="explain">{p.note} Days sold to installed is the median from the Approved date to the Completed date on jobs installed in the period, upgrades left out. GP is by the month jobs went Closed (the one GP rule), from Job Expenses, which covers the last 12 months.</p>
      <Installs s={s} />
      <Upgrades s={s} />
    </section>
  );
}

/** Records that look mislabeled in the CRM. On the Pulse it is one folded line; open it for the list. */
export function Flags({ s }: { s: any }) {
  const f: any[] = s.flags || [];
  const total = f.reduce((a, x) => a + (x.count || 0), 0);
  return (
    <section id="flags">
      <details className="flags">
        <summary>Data flags <span className="c">{total ? `${n0(total)} records in ${s.quarter.label} look mislabeled in ${CRM}` : `No mislabeled records in ${s.quarter.label}`}</span></summary>
        {f.length ? (
          <>
            <div className="tbl"><table>
              <thead><tr><th>Flag</th><th className="r">Count</th><th>Most</th></tr></thead>
              <tbody>{f.map((x) => <tr key={x.key}><td className="m">{x.label}</td><td className="r num">{n0(x.count)}</td><td>{x.most ? <>{x.most.name} <span className="sub">({x.most.role}, {x.most.count})</span></> : null}</td></tr>)}</tbody>
            </table></div>
            {f.map((x) => (
              <details key={x.key}><summary>{x.label} <span className="c">{x.count > 5 ? `Latest 5 of ${x.count}` : x.count}</span></summary><div className="tbl"><table>
                <thead><tr><th>Record</th><th>Rep</th><th>CSR</th><th>Lead date</th></tr></thead>
                <tbody>{x.rows.map((r: any, k: number) => <tr key={k}><td><RecLink rr={r.rr || "Open"} url={r.url} /></td><td>{r.rep}</td><td>{r.csr}</td><td className="num">{dfmt(r.date)}</td></tr>)}</tbody>
              </table></div></details>
            ))}
          </>
        ) : null}
      </details>
    </section>
  );
}

/** One tap to each deeper page. These used to be sections further down this page. */
function DeepLinks({ s, week }: { s: any; week: string }) {
  const q = week ? `?week=${week}` : "";
  const gp = s.costs?.windows?.["90"]?.total?.gp, gpGoal = s.costs?.goal;
  const W = s.cards?.windows?.["90"];
  const top = W?.cards?.[0];
  const rev = s.production?.periods?.quarter?.cur?.revenue;
  const pages: [string, string, string, React.ReactNode][] = [
    ["map", "Map", `Where ${CO.short_name} wins, by zip code. ${REGIONS.join(" vs ")}.`, null],
    ["team", "Team", "Each person's card this week, close rate by rep, hot and cold, player cards and the CSRs.", top ? <>#1 POWER: {top.rep}, {top.power}</> : null],
    ["production", "Production", "Revenue installed, installs this week, days from sold to installed, cycle time and upgrades.", rev != null ? <>{moneyK(rev)} installed this quarter</> : null],
    ["costs", "Job costing", "GP against the goal, where each dollar goes, crews and discounts.", gp != null ? <>GP {gp.toFixed(1)}% <Win>last 90 days</Win> goal {gpGoal}%</> : null],
    ["marketing", "Marketing", "Leads by source by month, cost per lead and per sold job, and what each lead source turns into.", null],
  ];
  return (
    <section className="deeplinks" aria-label="More pages">
      <h2>More pages <small>Each one is a tap away, also in the menu at the top.</small></h2>
      <div className="dl-grid">
        {pages.map(([k, t, d, x]) => (
          <Link key={k} href={`/pulse/hq/${k}${q}`} className="dl">
            <span className="dl-t">{t} <i aria-hidden>→</i></span>
            <span className="dl-d">{d}</span>
            {x ? <span className="dl-x">{x}</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function PulseView({ s, coaching, canAsk, week, first }: Props) {
  const [per, setPer] = usePersist("per", "quarter", ["week", "month", "quarter", "year"]);
  return (
    <div className="simple-page">
      <PageHelp keys={["strip", "priorities", "notes", "raise", "scorecard", "compare", "trend", "flags"]} />
      {first ? <Welcome first={first} role="lead" lastWeekJobs={(s.trend || []).slice(-1)[0]?.jobs_sold ?? null} /> : null}
      <Strip s={s} per={per} setPer={setPer} />
      <Priorities p={coaching?.priorities} at={coaching?.generated_at} dataAt={s.generated_at} />
      <Notes c={coaching} />
      <Scorecard s={s} per={per} setPer={setPer} />
      <Compare s={s} />
      <Trend s={s} />
      <DeepLinks s={s} week={week} />
      {canAsk ? <AskTeaser href={`/pulse/hq/ask${week ? `?week=${week}` : ""}`} ask={LEAD_ASK} help={LEAD_HELP} title="Ask Claude" note="About these numbers, or how to use anything here. Every chat is saved for you." /> : null}
      {canAsk ? <GraphicMaker scope="lead" /> : null}
      <Flags s={s} />
    </div>
  );
}
