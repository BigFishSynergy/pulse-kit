"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { GoalChip, Seg, usePersist, Win } from "./ui";
import { dfmt, money, moneyK, n0, paceClass, pct } from "@/lib/pulse/format";
import { CRM } from "@/lib/pulse/config";

// A CSR's own screen: their appointments and what came of them, their CSR card, the deals their
// appointments brought in, and the sales team's tops and totals, because the whole team gets paid when deals close.
// Built in site/pipeline/deals.py. A CSR sees only their own numbers and their own card, never another CSR's.

const PER: [string, string][] = [["week", "Week"], ["month", "Month"], ["quarter", "Quarter"]];
const SKILLS = ["booker", "converter", "show", "money", "speed"];
const AVG = 75, barW = (r: number) => `${((r - 40) / 59) * 100}%`;

function CsrCard({ card, name }: { card: any; name: string }) {
  const me = card?.me, soon = card?.coming;
  if (!me) {
    return (
      <div className="cl-panel cl-power">
        <span className="cl-k">My CSR card</span>
        {soon ? (
          <>
            <div className="cl-unlock"><i style={{ width: `${Math.min(100, (soon.demos / soon.needed) * 100)}%` }} /></div>
            <span className="sub"><b>{n0(soon.demos)} of {n0(soon.needed)}</b> of your appointments have sat. Your card unlocks at {n0(soon.needed)}. Every appointment counts.</span>
          </>
        ) : <span className="sub">Your card shows up after the next data pull.</span>}
      </div>
    );
  }
  const s = me.stats;
  return (
    <article className={`pcard me ${me.rank === 1 ? "first" : ""}`}>
      <header>
        <span className="rank num">#{me.rank} of {card.count}</span>
        <h3>{name}</h3>
        <div className="power"><span className="num">{me.power}</span><span className="label">Power</span></div>
      </header>
      <ul className="skills">
        {SKILLS.filter((k) => me.skills[k]).map((k) => {
          const sk = me.skills[k];
          return (
            <li key={k} className={sk.rating >= 85 ? "hot" : ""}>
              <span className="nm">{sk.label}</span>
              <span className="bar" title={`${sk.label} ${sk.rating}. The CSR average is ${AVG}.`}><i style={{ width: barW(sk.rating) }} /><b style={{ left: barW(AVG) }} /></span>
              <span className="num">{sk.rating}</span>
            </li>
          );
        })}
      </ul>
      <dl className="back">
        <div><dt>Appointments set</dt><dd className="num">{n0(s.set)}</dd></div>
        <div><dt>Sat</dt><dd className="num">{n0(s.sat)}</dd></div>
        <div><dt>Demos that signed</dt><dd className="num">{n0(s.signed)} <span className="sub">of {n0(s.demos)}</span></dd></div>
        <div><dt>Sales from them</dt><dd className="num">{moneyK(s.sales)}</dd></div>
        <div><dt>Booked same day</dt><dd className="num">{s.set ? pct(s.booked_same_day / s.set, 0) : "–"}</dd></div>
      </dl>
      <p className="sub pcard-note">{card.how}</p>
    </article>
  );
}

export default function CsrView({ c, viewer }: { c: any; viewer: "csr" | "lead" }) {
  const [per, setPer] = usePersist("csrPer", "month", PER.map((p) => p[0]));
  const P = c.periods[per];
  const name = c.csr;
  const conv = c.conversion, team = c.team_conversion;
  const goal = c.quarter_goal;
  const boards = P.boards ?? {};
  return (
    <div className="clean">
      {viewer === "lead" ? <div className="risk">Leadership view: this is {name}&apos;s CSR screen, exactly what {name} sees. <Link href="/pulse/hq/pulse">Back to the Pulse</Link></div> : null}
      <section className="cl-hero">
        <div>
          <span className="cl-hi">{viewer === "csr" ? `${name}, here's your ${per}` : name}</span>
          <h2>{P.label}<small>{dfmt(P.start)} to {dfmt(P.end)}</small></h2>
        </div>
        <Seg label="Period" value={per} options={PER} onChange={setPer} />
      </section>

      <section className="cl-kpis">
        <div className="cl-kpi"><span className="cl-k">Appointments set</span><span className="cl-v num">{n0(P.set)}</span><span className="cl-s">By the day you booked them</span></div>
        <div className="cl-kpi"><span className="cl-k">Sat</span><span className="cl-v num">{n0(P.sat)}</span><span className="cl-s">Appointments held with a quote</span></div>
        <div className="cl-kpi"><span className="cl-k">Jobs sold</span><span className="cl-v num">{n0(P.sold)}</span><span className="cl-s">From your appointments</span></div>
        <div className="cl-kpi"><span className="cl-k">Sales</span><span className="cl-v num">{moneyK(P.sales)}</span><span className="cl-s">Signed from your appointments</span></div>
      </section>

      <div className="cl-panel">
        <div className="cl-panel-h"><span className="cl-k">Your demos that signed</span><Win>last {conv.days} days</Win></div>
        <div className="cl-pow-row">
          <span className="cl-pow big"><b className="num">{pct(conv.pct, 0)}</b><small>{n0(conv.n)} of {n0(conv.of)}</small></span>
          <div>
            <span className="sub">Company: <b>{pct(team.pct, 0)}</b> ({n0(team.n)} of {n0(team.of)})</span>
            <span className="sub">Booked the same day the lead came in: <b>{pct(c.booked_same_day.pct, 0)}</b> ({n0(c.booked_same_day.n)} of {n0(c.booked_same_day.of)})</span>
          </div>
        </div>
        {c.ratings?.rows?.length ? (
          <ul className="cl-quotes">
            {c.ratings.rows.map((r: any) => (
              <li key={r.rating}>
                <span>{r.rating}</span>
                <span className="sub src">{n0(r.of)} demos</span>
                <b className="num">{r.pct == null ? "–" : pct(r.pct, 0)}</b>
                <span className="sub">signed</span>
              </li>
            ))}
          </ul>
        ) : null}
        <span className="sub">How each appointment rating you gave turned out. If Hot signs more than Good, your ratings are working.</span>
      </div>

      <CsrCard card={c.card} name={name} />

      {c.deals?.count ? (
        <section className="cl-panel">
          <div className="cl-panel-h"><span className="cl-k">Deals from your appointments</span><Win>last {c.deals.days} days</Win><span className="sub">{n0(c.deals.count)} signed, worth {moneyK(c.deals.total)}. Newest first.</span></div>
          <ul className="cl-quotes">
            {c.deals.rows.map((x: any, i: number) => (
              <li key={i}>
                <span>{x.rr ?? "Job"}</span>
                <span className="sub src">{x.rep || "Sales team"}</span>
                <b className="num">{money(x.amount)}</b>
                <span className="sub">{dfmt(x.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="cl-panel">
        <div className="cl-panel-h"><span className="cl-k">The team</span><span className="sub">Everyone gets paid when deals close.</span></div>
        <div className="cl-pow-row">
          <span className="cl-v num">{moneyK(P.team.sales)}</span>
          <div>
            <span className="sub">Team sales, {P.label.toLowerCase()}: {n0(P.team.jobs_sold)} jobs sold</span>
            {goal?.sales_goal ? <span className="sub">This quarter: <b>{moneyK(goal.sales_qtd)}</b> of the {moneyK(goal.sales_goal)} goal{goal.pacing ? <> <GoalChip state={paceClass(goal.pacing)}>{pct(goal.pacing, 0)} of pace</GoalChip></> : null}</span> : null}
          </div>
        </div>
        <div className="boards">
          {["sales", "jobs_sold", "close"].filter((k) => boards[k]).map((k) => (
            <div key={k}>
              <span className="label">{boards[k].label}</span>
              {boards[k].note ? <span className="sub">{boards[k].note}</span> : null}
              <ol className="podium">
                {boards[k].top.length ? boards[k].top.map((x: any) => (
                  <li key={x.rep} className={x.rank === 1 ? "first" : ""}>
                    <span><span className="place">{x.rank}</span>{x.rep}</span>
                    <span className="num">{boards[k].fmt === "money" ? moneyK(x.value) : boards[k].fmt === "rate" ? pct(x.value, 0) : n0(x.value)}</span>
                  </li>
                )) : null}
              </ol>
              {boards[k].top.length ? null : <span className="sub">Nobody on this board yet.</span>}
            </div>
          ))}
        </div>
      </section>

      <p className="cl-foot sub">Numbers come from {CRM} with the company&apos;s rules, the same as the sales team&apos;s. The Speed Round is in the menu at the top.</p>
    </div>
  );
}
