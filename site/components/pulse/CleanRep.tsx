"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { MyMeter } from "./HotCold";
import RepDeals from "./RepDeals";
import { SameDayMeter } from "./PlayerCards";
import { Seg, usePersist, Win } from "./ui";
import { dfmt, money, moneyK, n0, n1, pct } from "@/lib/pulse/format";

// The Clean look for a rep: my numbers, my meter, my player card, my open quotes; plus same-day closes
// and why deals got away (Oct 13 2026).
// Reports, Ask Claude, the Speed Round and every other section stay in the menu and the Everything look.
// Same file as the Everything look, only this rep's.

const PER: [string, string][] = [["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]];

// Up or down against last year, in plain gray text. Rep files carry no goals, so nothing here is colored.
function change(a: number | null | undefined, b: number | null | undefined, points?: boolean) {
  if (a == null || b == null) return null;
  if (points) { const p = (a - b) * 100; return `${p >= 0 ? "+" : "−"}${Math.abs(p) < 1 ? Math.abs(p).toFixed(1) : Math.round(Math.abs(p))} pts`; }
  if (!b) return a ? "New" : null;
  const c = (a - b) / b;
  return `${c >= 0 ? "+" : "−"}${pct(Math.abs(c), 0)}`;
}

export default function CleanRep({ r, viewer, week }: { r: any; canAsk?: boolean; viewer: "rep" | "lead"; week?: string }) {
  const [per, setPer] = usePersist("cleanRepPer", "month", PER.map((p) => p[0]));
  const P = r.periods[per];
  const first = r.rep.split(" ")[0];
  const W = r.card?.windows?.["90"];
  const me = W?.me, soon = W?.coming;
  const skills = me ? Object.values(me.skills as Record<string, any>).sort((a: any, b: any) => b.rating - a.rating) : [];
  const fu = r.follow_ups;

  const tiles: { key: string; label: string; show: (v: any) => string; rate?: boolean; team: (t: any) => string }[] = [
    { key: "sales", label: "Sales", show: moneyK, team: (t) => moneyK(t) },
    { key: "jobs_sold", label: "Jobs sold", show: n0, team: (t) => n1(t) },
    { key: "close", label: "Close rate", show: (v) => pct(v?.pct, 0), rate: true, team: (t) => pct(t?.pct, 0) },
    { key: "avg_ticket", label: "Avg ticket", show: money, team: (t) => money(t) },
  ];

  return (
    <div className="clean">
      {viewer === "lead" ? <div className="risk">Leadership view: this is {r.rep}&apos;s Clean screen. <Link href={`/pulse/hq/pulse${week ? `?week=${week}` : ""}`}>Back to the Pulse</Link></div> : null}
      <section className="cl-hero">
        <div>
          <span className="cl-hi">{viewer === "rep" ? `${first}, here's your ${per === "week" ? "week" : per}` : r.rep}</span>
          <h2>{P.label}<small>{dfmt(P.start)} to {dfmt(P.end)}</small></h2>
        </div>
        <Seg label="Period" value={per} options={PER} onChange={setPer} />
      </section>

      <section className="cl-kpis">
        {tiles.map((t) => {
          const v = P.me[t.key], l = P.ly[t.key], team = P.team.per_rep[t.key];
          const c = t.rate ? change(v?.pct, l?.pct, true) : change(v, l);
          return (
            <div key={t.key} className="cl-kpi">
              <span className="cl-k">{t.label}{t.rate && r.close_window ? <Win>last {r.close_window.days} days</Win> : null}</span>
              <span className="cl-v num">{t.show(v)}</span>
              <span className="vsly">{c ? `${c} ` : ""}vs {t.rate ? pct(l?.pct, 0) : t.show(l)} last year</span>
              <span className="cl-s">Team, per rep: {t.team(team)}</span>
            </div>
          );
        })}
      </section>

      <MyMeter meter={r.meter} viewer={viewer} />

      <RepDeals r={r} viewer={viewer} />

      <div className="cl-panel cl-power">
        <span className="cl-k">My player card</span>
        {me ? (
          <>
            <div className="cl-pow-row">
              <span className={`cl-pow big${me.power > 50 ? " good" : ""}${me.rank === 1 ? " first" : ""}`}><b className="num">{me.power}</b><small>Power</small></span>
              <div>
                <span className="cl-place">#{me.rank} of {W.count}</span>
                <span className="sub">Best skill: <b>{skills[0]?.label} {skills[0]?.rating}</b></span>
                <span className="sub">Fastest way up: <b>{skills[skills.length - 1]?.label} {skills[skills.length - 1]?.rating}</b></span>
              </div>
            </div>
            <SameDayMeter sd={me.same_day} base={me.base_power} power={me.power} />
            <span className="sub"><Win>last 90 days</Win> The team average is 75 in every skill. Same-day closes add up to 3 POWER, or take off up to 3.</span>
          </>
        ) : soon ? (
          <>
            <div className="cl-unlock"><i style={{ width: `${Math.min(100, (soon.demos / soon.needed) * 100)}%` }} /></div>
            <span className="sub"><b>{n0(soon.demos)} of {n0(soon.needed)} demos.</b> Your card unlocks at {n0(soon.needed)}. Every demo counts.</span>
          </>
        ) : <span className="sub">Your card shows up after the next data pull.</span>}
      </div>

      {fu?.count ? (
        <section className="cl-panel">
          <div className="cl-panel-h"><span className="cl-k">Open quotes</span><Win>last {fu.window_days} days</Win><span className="sub">{n0(fu.count)} quotes worth {moneyK(fu.quoted_total)}. Newest first.</span></div>
          <ul className="cl-quotes">
            {(fu.rows ?? []).slice(0, 5).map((x: any, i: number) => (
              <li key={i}>
                {x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.town || "Open"}</a> : <span>{x.town || "–"}</span>}
                <span className="sub src">{x.source} · {x.status}</span>
                <b className="num">{money(x.quote)}</b>
                <span className="sub">{x.days === 0 ? "today" : `${n0(x.days)}d ago`}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="cl-foot sub">My reports, Ask Claude and the Speed Round are in the menu at the top. My map, trend, GP and every other section are one tap away in Everything.</p>
    </div>
  );
}
