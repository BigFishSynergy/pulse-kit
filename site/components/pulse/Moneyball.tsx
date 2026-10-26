"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { REGIONS } from "@/lib/pulse/county";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { aggregate, zero, add, type Facts, type Totals } from "@/lib/pulse/ledger";
import { Seg, usePersist } from "./ui";
import { dfmt, money, moneyK, n0, pct } from "@/lib/pulse/format";

// Moneyball: who to send where, where to advertise, and what is far enough from normal to act on.
// Everything is summed from the Report Builder ledger (the rules' counts). Sales per sit = sales dollars / close-rate sits.
// A rep's number in one area is pulled toward that rep's own usual until there are enough sits there, and a rep's
// usual is pulled toward the team's until they have enough sits, so a hot week in a small town does not decide the lineup.

const WIN: [string, string][] = [["90", "90 days"], ["365", "12 months"], ["730", "2 years"], ["all", "All time"]];
const K = 12; // sits of pull toward the rep's own usual
const K_TEAM = 30; // sits of pull from a rep's usual toward the team's, same as the player cards
const MIN_TOWN_SITS = 15;
const MIN_HERE = 3; // sits in an area before a rep counts as proven there
const sps = (t?: Totals | null) => (t && t.cs ? t.sales / t.cs : null);
const close = (t?: Totals | null) => (t && t.cs ? t.cw / t.cs : null);
const LI = (k: string) => REGIONS.some((r) => k === r || k.endsWith(` (${r})`));
const addDays = (s: string, n: number) => new Date(Date.parse(s + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const minus = (a: Totals, b: Totals) => { const o = { ...a }; (Object.keys(o) as (keyof Totals)[]).forEach((k) => (o[k] -= b[k])); return o; };

type Lineup = { rep: string; here: Totals; usual: number; score: number; vsUsual: number | null };

/** Each rep's usual sales per sit, pulled toward the team's when they have few sits. */
function usualOf(byRep: Map<string, Totals>) {
  let s = 0, n = 0;
  byRep.forEach((t) => { s += t.sales; n += t.cs; });
  const team = n ? s / n : 0;
  const out = new Map<string, number>();
  byRep.forEach((t, rep) => { if (t.cs) out.set(rep, (t.sales + K_TEAM * team) / (t.cs + K_TEAM)); });
  return out;
}

function lineup(area: string, byAreaRep: Map<string, Map<string, Totals>>, U: Map<string, number>): Lineup[] {
  const row = byAreaRep.get(area) ?? new Map<string, Totals>();
  const out: Lineup[] = [];
  U.forEach((usual, rep) => {
    const here = row.get(rep) ?? zero();
    out.push({ rep, here, usual, score: (here.sales + K * usual) / (here.cs + K), vsUsual: here.cs >= 5 && usual ? (sps(here)! - usual) / usual : null });
  });
  // reps with a track record here first, then everyone else on their usual
  return out.sort((a, b) => Number(b.here.cs >= MIN_HERE) - Number(a.here.cs >= MIN_HERE) || b.score - a.score);
}

export default function Moneyball({ asOf }: { asOf: string }) {
  const [f, setF] = useState<Facts | null>(null);
  const [err, setErr] = useState("");
  const [win, setWin] = usePersist("mbWin", "365", WIN.map((w) => w[0]));
  const [level, setLevel] = usePersist("mbLevel", "county", ["county", "town"]);
  const [area, setArea] = useState(REGIONS[0] ?? "");
  const [share, setShare] = useState(25);
  useEffect(() => {
    fetch("/pulse/api/facts").then((r) => (r.ok ? r.json() : Promise.reject())).then(setF).catch(() => setErr("The numbers could not load. Reload the page."));
  }, []);

  const start = f ? (win === "all" ? f.epoch : addDays(asOf, -(+win - 1))) : asOf;
  const calc = useMemo(() => {
    if (!f) return null;
    const team = { teamOnly: true, closeTeam: true };
    const byRep = new Map<string, Totals>();
    aggregate(f, start, asOf, team, "rep").forEach((m, rep) => byRep.set(rep, m.get("All") ?? zero()));
    const U = usualOf(byRep);
    const byCountyRep = aggregate(f, start, asOf, team, "county", "rep");
    const byTownRep = aggregate(f, start, asOf, team, "town", "rep");
    const total = (m?: Map<string, Totals>) => { let t = zero(); m?.forEach((x) => (t = add(t, x))); return t; };
    const towns = [...byTownRep.entries()].filter(([k]) => LI(k)).map(([k, m]) => ({ k, t: total(m) })).filter((x) => x.t.cs >= MIN_TOWN_SITS).sort((a, b) => b.t.cs - a.t.cs);
    // company-wide (every rep, every quoted sit) for advertising and spots
    const company = aggregate(f, start, asOf, {}, "town");
    const all = total(new Map([...company.entries()].filter(([k]) => LI(k)).map(([k, m]) => [k, m.get("All") ?? zero()])));
    const chan = aggregate(f, start, asOf, {}, "src", "county");
    return { byRep, U, byCountyRep, byTownRep, towns, total, company, all, chan };
  }, [f, start, asOf]);

  if (err) return <div className="state"><h2>{err}</h2></div>;
  if (!f || !calc) return <div className="state"><h2>Loading the numbers</h2></div>;
  const { byRep, U, byCountyRep, byTownRep, towns, total, company, all, chan } = calc;
  const areas = level === "county" ? REGIONS : towns.map((t) => t.k);
  const cur = areas.includes(area) ? area : areas[0];
  const byAreaRep = level === "county" ? byCountyRep : byTownRep;
  const L = cur ? lineup(cur, byAreaRep, U) : [];
  const areaT = total(byAreaRep.get(cur));
  const best = L[0];
  const others = best ? minus(areaT, best.here) : zero();
  const gain = best && sps(others) != null ? (share / 100) * others.cs * (best.score - sps(others)!) : null;

  // every area's best proven rep, if they had taken a share of the area's other sits
  const lineupAll = areas.map((a) => {
    const l = lineup(a, byAreaRep, U);
    if (!l.length) return null;
    const o = minus(total(byAreaRep.get(a)), l[0].here);
    return { area: a, gain: sps(o) != null ? (share / 100) * o.cs * (l[0].score - sps(o)!) : 0 };
  }).filter(Boolean) as { area: string; gain: number }[];
  const totalGain = lineupAll.reduce((a, x) => a + Math.max(0, x.gain), 0);

  // grid: reps down the side, areas across
  const gridAreas = level === "county" ? REGIONS : towns.slice(0, 10).map((t) => t.k);
  const reps = [...U.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);

  // spots: far enough from normal that chance is unlikely (about 95% sure)
  const z = (p: number, p0: number, n: number) => (p0 > 0 && p0 < 1 ? (p - p0) / Math.sqrt((p0 * (1 - p0)) / n) : 0);
  const p0 = close(all) ?? 0;
  const townSpots = [...company.entries()].filter(([k]) => LI(k)).map(([k, m]) => ({ k, t: m.get("All") ?? zero() }))
    .filter((x) => x.t.cs >= MIN_TOWN_SITS).map((x) => ({ ...x, z: z(close(x.t)!, p0, x.t.cs) }));
  const hot = townSpots.filter((x) => x.z >= 1.96).sort((a, b) => b.z - a.z).slice(0, 6);
  const cold = townSpots.filter((x) => x.z <= -1.96).sort((a, b) => a.z - b.z).slice(0, 6);
  const hands: { rep: string; k: string; t: Totals; usual: number; zz: number }[] = [];
  byTownRep.forEach((m, k) => {
    if (!LI(k)) return;
    m.forEach((t, rep) => {
      const u = close(byRep.get(rep));
      if (u == null || t.cs < 8) return;
      const zz = z(close(t)!, u, t.cs);
      if (zz >= 1.96) hands.push({ rep, k, t, usual: u, zz });
    });
  });
  hands.sort((a, b) => b.zz - a.zz);

  // where to advertise: channels by county, company-wide
  const chRows = [...chan.entries()].map(([src, m]) => ({ src, by: REGIONS.map((r) => m.get(r) ?? zero()) }))
    .map((r) => ({ ...r, leads: r.by.reduce((a, t) => a + t.leads, 0), sales: r.by.reduce((a, t) => a + t.sales, 0) }))
    .filter((r) => r.leads >= 20 && r.src !== "(blank)").sort((a, b) => b.sales - a.sales).slice(0, 12);
  const spl = (t: Totals) => (t.leads ? t.sales / t.leads : null);

  return (
    <div className="mb">
      <section>
        <div className="sechead">
          <h2>Moneyball <small>{dfmt(start)} {start.slice(0, 4)} to {dfmt(asOf)} {asOf.slice(0, 4)}. Sales team, the company&apos;s counting rules.</small></h2>
          <div className="seg-row">
            <Seg label="Moneyball window" value={win} options={WIN} onChange={setWin} />
            <Seg label="Area" value={level} options={[["county", "Counties"], ["town", "Towns"]]} onChange={setLevel} />
          </div>
        </div>
        <p className="explain">The scoreboard number is <b>sales per sit</b>: what each appointment a rep runs turns into, in dollars. It folds close rate and ticket together. In one area, a rep&apos;s number is pulled toward their own usual until they have about {K} sits there, and a rep&apos;s usual is pulled toward the team&apos;s until they have about {K_TEAM} sits, so small samples cannot top the lineup on luck.</p>
      </section>

      <section>
        <h2>Who to send <small>Pick an area. The rep at the top has the best proven results there.</small></h2>
        <div className="chips">
          {areas.map((a) => <button key={a} type="button" className={a === cur ? "on" : ""} onClick={() => setArea(a)}>{a}</button>)}
        </div>
        {level === "town" ? <p className="sub">Towns with at least {MIN_TOWN_SITS} sales team sits in this window, most sits first.</p> : null}
        {L.length ? (
          <div className="tbl">
            <table className="tight lineup">
              <thead><tr><th>#</th><th>Rep</th><th className="r">Expected per sit</th><th className="r">Sits here</th><th className="r">Close here</th><th className="r">Ticket here</th><th className="r">Vs their usual</th></tr></thead>
              <tbody>{L.map((x, i) => (
                <tr key={x.rep} className={i === 0 ? "on" : ""}>
                  <td className="num">{i + 1}</td><td className="m">{x.rep}</td>
                  <td className="r num">{money(x.score)}</td>
                  <td className="r num">{n0(x.here.cs)}</td>
                  <td className="r num">{x.here.cs ? <>{pct(close(x.here), 0)} <span className="sub">{x.here.cw}/{x.here.cs}</span></> : "–"}</td>
                  <td className="r num">{x.here.jobs ? money(x.here.sales / x.here.jobs) : "–"}</td>
                  <td className={`r num ${x.vsUsual != null && x.vsUsual > 0.1 ? "best" : ""}`}>{x.here.cs < MIN_HERE ? <span className="sub">not enough here</span> : x.vsUsual == null ? <span className="sub">few sits</span> : `${x.vsUsual >= 0 ? "+" : ""}${pct(x.vsUsual, 0)}`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="empty-note">No sales team sits here in this window.</div>}
      </section>

      {best && gain != null ? (
        <section className="whatif">
          <h2>What if <small>An estimate from these numbers, not a promise. Calendars and travel time are real limits.</small></h2>
          <label className="slider"><span>Send <b>{share}%</b> of the other reps&apos; {cur} sits to {best.rep}</span>
            <input type="range" min={0} max={100} step={5} value={share} onChange={(e) => setShare(+e.target.value)} aria-label="Share of sits to move" />
          </label>
          <div className="strip">
            <div><span className="label">{cur}, this window</span><span className="big num">{gain >= 0 ? "+" : ""}{moneyK(gain)}</span><span className="sub">{n0((share / 100) * others.cs)} sits at {money(best.score)} each instead of {money(sps(others))}</span></div>
            <div><span className="label">Every {level === "county" ? "county" : "town on the list"}, best rep each</span><span className="big num">+{moneyK(totalGain)}</span><span className="sub">{share}% of each area&apos;s other sits to its best proven rep</span></div>
          </div>
        </section>
      ) : null}

      <section>
        <h2>Rep by area <small>Sales per sit. Green is better than that rep&apos;s own usual, red is below it. Gray means fewer than 5 sits.</small></h2>
        <div className="tbl">
          <table className="tight mbgrid">
            <thead><tr><th>Rep</th><th className="r">Usual</th>{gridAreas.map((a) => <th key={a} className="r">{a.replace(/ \([^)]*\)$/, "")}</th>)}</tr></thead>
            <tbody>{reps.map((r) => {
              const u = U.get(r) ?? null;
              return (
                <tr key={r}>
                  <td className="m">{r}</td><td className="r num">{money(u)} <span className="sub">{n0(byRep.get(r)?.cs)}</span></td>
                  {gridAreas.map((a) => {
                    const t = byAreaRep.get(a)?.get(r);
                    const v = t && t.cs >= 5 ? sps(t) : null;
                    const cls = v == null || u == null ? "dim" : v > u * 1.1 ? "up" : v < u * 0.9 ? "down" : "";
                    return <td key={a} className={`r num ${cls}`}>{v == null ? (t?.cs ? <span className="sub">{t.cs} sits</span> : "–") : <>{moneyK(v)} <span className="sub">{t!.cs}</span></>}</td>;
                  })}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="sub">Small numbers next to each value are the sits behind it.</p>
      </section>

      <section>
        <h2>Hot and cold spots <small>Close rates far enough from normal that chance is unlikely (about 95% sure). Company-wide, every quoted sit.</small></h2>
        <div className="two">
          <div>
            <span className="label">Hot towns</span>
            <ul className="mini">{hot.length ? hot.map((x) => <li key={x.k}><span>{x.k}</span><span className="num best">{pct(close(x.t), 0)} <span className="sub">{x.t.cw}/{x.t.cs} vs {pct(p0, 0)}</span></span></li>) : <li><span className="sub">None stand out in this window.</span></li>}</ul>
          </div>
          <div>
            <span className="label">Cold towns</span>
            <ul className="mini">{cold.length ? cold.map((x) => <li key={x.k}><span>{x.k}</span><span className="num">{pct(close(x.t), 0)} <span className="sub">{x.t.cw}/{x.t.cs} vs {pct(p0, 0)}</span></span></li>) : <li><span className="sub">None stand out in this window.</span></li>}</ul>
          </div>
        </div>
        <span className="label">Hot hands <span className="sub">A rep closing a town far above their own usual. Worth sending them back.</span></span>
        <ul className="mini">{hands.length ? hands.slice(0, 8).map((x) => <li key={x.rep + x.k}><span>{x.rep} in {x.k}</span><span className="num best">{pct(close(x.t), 0)} <span className="sub">{x.t.cw}/{x.t.cs} vs their {pct(x.usual, 0)}</span></span></li>) : <li><span className="sub">None stand out in this window. Try a longer window.</span></li>}</ul>
      </section>

      <section>
        <h2>Where to advertise <small>Lead channels by county, company-wide. Sales per lead is what each lead turned into. The better county per channel is green.</small></h2>
        <div className="tbl">
          <table className="tight">
            <thead><tr><th>Channel</th>{REGIONS.map((g) => <Fragment key={g}><th className="r">{g} leads</th><th className="r">{g} per lead</th></Fragment>)}</tr></thead>
            <tbody>{chRows.map((r) => {
              const per = r.by.map((t) => (t.leads >= 10 ? spl(t) : null));
              const top = per.reduce<number>((bi, v, i) => (v != null && (bi < 0 || v > (per[bi] ?? -1)) ? i : bi), -1);
              return (
                <tr key={r.src}>
                  <td className="m">{r.src}</td>
                  {r.by.map((t, i) => <Fragment key={i}><td className="r num">{n0(t.leads)}</td><td className={`r num ${i === top && per.filter((v) => v != null).length > 1 ? "best" : ""}`}>{money(spl(t))}</td></Fragment>)}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="explain">Ad spend is tracked by vendor and month, not by county, so this shows what leads turned into, not cost per lead. The <Link href="/pulse/hq/map">map</Link> has the same idea by zip, and <Link href="/pulse/hq/reports">Reports</Link> can group any of this by county, town or channel.</p>
      </section>
    </div>
  );
}
