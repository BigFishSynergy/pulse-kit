"use client";
import SecHelp from "./SecHelp";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Win } from "./ui";
import { dfmt, money, moneyK, n0, pct } from "@/lib/pulse/format";

// Player cards: each rep's POWER number and six skill ratings over the last 90 days (40 to 99, team average 75), like the
// back of a sports card. Built in site/pipeline/cards.py from the rules' counts. A rep earns a card at 30 demos.
// Leadership sees every card; a rep sees their own and the top 3. The record book replays the card every Monday.

const ORDER = ["money", "closer", "ticket", "hustle", "rapid", "selfgen", "speed"]; // speed (Quick Close) only on data before Oct 9 2026
const AVG = 75, barW = (r: number) => `${((r - 40) / 59) * 100}%`;
const yr = (iso: string) => `${dfmt(iso)} ${iso.slice(0, 4)}`;
const weeks = (n: number) => `${n0(n)} week${n === 1 ? "" : "s"}`;
const TARGET_FMT: Record<string, (v: number) => string> = {
  closer: (v) => pct(v, 0), money: moneyK, ticket: (v) => money(Math.round(v / 100) * 100), hustle: (v) => `${n0(v)} sits`,
  selfgen: (v) => `${n0(Math.ceil(v))} leads`, speed: (v) => pct(v, 0), rapid: (v) => days(v),
};
const days = (v: number | null | undefined) => (v == null ? "–" : `${v < 10 ? v.toFixed(1) : n0(v)} day${v === 1 ? "" : "s"}`);

/** The same-day modifier as a meter: seven cells from -3 to +3 POWER, this rep's lit, and the math under it. */
export function SameDayMeter({ sd, base, power }: { sd: any; base?: number; power?: number }) {
  if (!sd) return null;
  const m = sd.modifier ?? 0, sign = m > 0 ? `+${m}` : `${m}`;
  return (
    <div className="sdm" title="How often demos sign the day they are held, rated against the team. The team average adds nothing.">
      <span className="nm">Same-day</span>
      <span className="cells" aria-label={`Same-day modifier ${sign} POWER`}>
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => <i key={k} className={k === m ? `on ${k > 0 ? "pos" : k < 0 ? "neg" : "zero"}` : ""} />)}
      </span>
      <span className="num chg">{sign}</span>
      <span className="sub why">{sd.pct == null ? "No demos yet" : `${pct(sd.pct, 0)} same-day (${n0(sd.n)} of ${n0(sd.of)}) · team ${pct(sd.team, 0)}`}{base != null && power != null ? ` · skills ${base} ${m >= 0 ? "+" : "−"} ${Math.abs(m)} = ${power} POWER` : ""}</span>
    </div>
  );
}

function Card({ c, href, me, photo }: { c: any; href?: string; me?: boolean; photo?: number }) {
  const s = c.stats;
  const name = href ? <Link href={href}>{c.rep}</Link> : c.rep;
  return (
    <article className={`pcard ${me ? "me" : ""} ${c.rank === 1 ? "first" : ""}`}>
      <header>
        <span className="rank num">#{c.rank}</span>
        <h3>{photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pface" src={`/pulse/api/photo/${c.slug}?v=${photo}`} alt="" />
        ) : null}{name}</h3>
        <div className="power"><span className="num">{c.power}</span><span className="label">Power</span></div>
      </header>
      <div className="ups">
        {c.power_ups.length ? c.power_ups.map((u: string) => <span key={u} className="up">{u}</span>) : <span className="sub">Power-ups unlock at 85 in a skill</span>}
      </div>
      <ul className="skills">
        {ORDER.filter((k) => c.skills[k]).map((k) => {
          const sk = c.skills[k];
          return (
            <li key={k} className={sk.rating >= 85 ? "hot" : ""}>
              <span className="nm">{sk.label}</span>
              <span className="bar" title={`${sk.label} ${sk.rating}. Team average is ${AVG}.`}><i style={{ width: barW(sk.rating) }} /><b style={{ left: barW(AVG) }} /></span>
              <span className="num">{sk.rating}</span>
            </li>
          );
        })}
      </ul>
      <SameDayMeter sd={c.same_day} base={c.base_power} power={c.power} />
      <dl className="back">
        <div><dt>Sales</dt><dd className="num">{moneyK(s.sales)}</dd></div>
        <div><dt>Jobs sold</dt><dd className="num">{n0(s.jobs_sold)}</dd></div>
        <div><dt>Close</dt><dd className="num">{s.close.pct != null ? <>{pct(s.close.pct, 0)} <span className="sub">{n0(s.close.n)}/{n0(s.close.d)}</span></> : "–"}</dd></div>
        <div><dt>Avg ticket</dt><dd className="num">{money(s.avg_ticket)}</dd></div>
        <div><dt>Sales per sit</dt><dd className="num">{money(s.sales_per_sit)}</dd></div>
        <div><dt>Sits</dt><dd className="num">{n0(s.sits)}</dd></div>
        <div><dt>Self-gen leads</dt><dd className="num">{n0(s.self_gen_leads)}</dd></div>
        {s.days_to_close_30 !== undefined
          ? <div title={`Average days from the appointment to the signed contract, on ${n0(s.sales_30)} sales signed in the last 30 days`}><dt>Days to close <span className="sub">30d</span></dt><dd className="num">{days(s.days_to_close_30)}</dd></div>
          : <div><dt>Sold in 7 days</dt><dd className="num">{s.timed ? pct(s.sold_within_7 / s.timed, 0) : "–"}</dd></div>}
      </dl>
    </article>
  );
}

/** A rep still earning their card: N of 30 demos. */
function Unlock({ c, href }: { c: any; href?: string }) {
  return (
    <div className="unlock">
      <span className="nm">{href ? <Link href={href}>{c.rep}</Link> : c.rep}</span>
      <span className="track" aria-label={`${c.demos} of ${c.needed} demos`}><i style={{ width: `${Math.min(100, (c.demos / c.needed) * 100)}%` }} /></span>
      <span className="sub"><b>{n0(c.demos)} of {n0(c.needed)} demos</b> · card unlocks at {n0(c.needed)} · {n0(c.jobs_sold)} sold so far</span>
    </div>
  );
}

/** The record book: the highest POWER ever, the current #1's streak, personal bests. */
function Records({ r, lead }: { r: any; lead?: boolean }) {
  if (!r?.high) return null;
  const h = r.high, one = r.number_one;
  return (
    <div className="records">
      <div className="rec hero">
        <span className="label">Record high</span>
        <span className="val"><span className="num">{h.power}</span> {h.rep}</span>
        <span className="sub">Week of {yr(h.week)}. Standing {weeks(h.standing_weeks)}.{h.tied?.length ? <> Tied by {h.tied.map((t: any) => `${t.rep} (${yr(t.week)})`).join(", ")}.</> : null}</span>
      </div>
      {one ? (
        <div className="rec">
          <span className="label">#1 right now</span>
          <span className="val"><span className="num">{n0(one.weeks)}</span> {one.weeks === 1 ? "week" : "weeks"} in a row</span>
          <span className="sub">{one.rep} at {one.power}, on top since the week of {yr(one.since)}.</span>
        </div>
      ) : null}
      {lead && r.weeks_at_number_one?.length ? (
        <div className="rec">
          <span className="label">Most weeks at #1</span>
          <ol className="podium">{r.weeks_at_number_one.slice(0, 3).map((x: any, i: number) => <li key={x.rep} className={i === 0 ? "first" : ""}><span><span className="place">{i + 1}</span>{x.rep}</span><span className="num">{weeks(x.weeks)}</span></li>)}</ol>
        </div>
      ) : null}
      {lead && r.best?.length ? (
        <div className="rec">
          <span className="label">Personal bests</span>
          <ol className="podium">{r.best.map((x: any) => <li key={x.rep}><span>{x.rep} <span className="sub">{yr(x.week)}</span></span><span className="num">{x.power}</span></li>)}</ol>
        </div>
      ) : null}
      {!lead && r.my_best ? (
        <div className="rec">
          <span className="label">Your best</span>
          <span className="val"><span className="num">{r.my_best.power}</span> POWER</span>
          <span className="sub">Week of {yr(r.my_best.week)}.{r.my_best.power === h.power ? " That ties the record." : ` ${h.power - r.my_best.power} short of the record.`}</span>
        </div>
      ) : null}
    </div>
  );
}

/** What an 85 (a power-up) and a 90 take in each skill right now, in real numbers. */
function Targets({ t }: { t: any[] }) {
  if (!t?.length) return null;
  const order = ORDER.map((k) => t.find((x) => x.key === k)).filter(Boolean);
  const rapid = t.some((x) => x.key === "rapid");
  return (
    <details className="targets">
      <summary>What it takes to hit 85 and 90 <span className="c">over 90 days</span></summary>
      <div className="tbl"><table className="tight">
        <thead><tr><th>Skill</th><th className="r">Team average (75)</th><th className="r">85, a power-up</th><th className="r">90</th></tr></thead>
        <tbody>{order.map((x: any) => {
          const f = TARGET_FMT[x.key];
          return <tr key={x.key}><td className="m">{x.label}</td><td className="r num">{f(x.team)}</td><td className="r num">{x.for_85 != null ? f(x.for_85) : "–"}</td><td className="r num">{x.for_90 != null ? f(x.for_90) : "–"}</td></tr>;
        })}</tbody>
      </table></div>
      <p className="explain">Moves as the team moves. A 99 takes about two and a half times the team&apos;s rate, or four times its volume. Close rate and ticket need a full 90 days of sits to count all the way.{rapid ? " Quick Close is average days from the appointment to the signed contract over the last 30 days; fewer is better." : ""}</p>
    </details>
  );
}

/** Leadership: appointment to signed contract by rep, last 30 days, quickest first. Rookies included. */
function RapidBoard({ b, href, slugs }: { b: any; href: (slug: string) => string; slugs: Record<string, string> }) {
  if (!b?.rows?.length) return null;
  return (
    <div>
      <span className="label">Quick Close board <span className="sub">Appointment to signed contract on sales signed {dfmt(b.start)} to {dfmt(b.end)}. Quickest first. Team average {days(b.team.average)}, typical (median) {days(b.team.median)}.</span></span>
      <div className="tbl"><table className="tight">
        <thead><tr><th>Rep</th><th className="r">Sales signed</th><th className="r">Average days</th><th className="r">Typical (median)</th><th className="r">Same day</th><th className="r">Within 7 days</th><th className="r">Over 30 days</th></tr></thead>
        <tbody>{b.rows.map((r: any, i: number) => (
          <tr key={r.rep}>
            <td className="m">{slugs[r.rep] ? <Link href={href(slugs[r.rep])}>{r.rep}</Link> : r.rep}{r.sales < 5 ? <span className="sub"> few sales</span> : null}</td>
            <td className="r num">{n0(r.sales)}</td>
            <td className={`r num ${i === 0 && r.sales >= 5 ? "best" : ""}`}>{days(r.average)}</td>
            <td className="r num">{days(r.median)}</td>
            <td className="r num">{n0(r.same_day)}</td>
            <td className="r num">{n0(r.within_7)}</td>
            <td className="r num">{n0(r.over_30)}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

/** Leadership: every rep's card, best power first, who is still earning one, and the record book. */
export default function PlayerCards({ cards, week, photos = {} }: { cards: any; week?: string; photos?: Record<string, number> }) {
  const W = cards?.windows?.["90"];
  if (!W) return null;
  const href = (slug: string) => `/pulse/hq/rep/${slug}${week ? `?week=${week}` : ""}`;
  return (
    <section id="cards">
      <div className="sechead">
        <h2>Player cards <small>{dfmt(W.start)} to {dfmt(W.end)}. The team average is {AVG}; the red tick on each bar marks it. A rep earns a card at 30 demos.</small> <SecHelp k="cards" /></h2>
      </div>
      <div className="wins"><Win>last 90 days</Win></div>
      <div className="pcards">
        {W.cards.map((c: any) => <Card key={c.rep} c={c} href={href(c.slug)} photo={photos[c.slug]} />)}
      </div>
      {W.coming?.length ? (
        <div className="unlocks">
          <span className="label">Earning a card</span>
          {W.coming.map((c: any) => <Unlock key={c.rep} c={c} href={href(c.slug)} />)}
        </div>
      ) : null}
      <span className="label">Record book <span className="sub">Every Monday since {cards.record ? yr(cards.record.from) : "–"}, replayed on the 90 days before it.</span></span>
      <Records r={cards.record} lead />
      <Targets t={W.targets} />
      <RapidBoard b={W.rapid_board} href={href} slugs={Object.fromEntries([...W.cards, ...(W.coming ?? [])].map((c: any) => [c.rep, c.slug]))} />
      <p className="explain">{cards.how} Sales team close rate rule, same counts as the leaderboards. {cards.record?.note}</p>
    </section>
  );
}

/** A rep's own card (or when it unlocks), the top 3 power numbers, their place, and the record book. */
export function MyCard({ card }: { card: any }) {
  const W = card?.windows?.["90"];
  if (!W || (!W.me && !W.coming)) return null;
  return (
    <section id="card">
      <div className="sechead">
        <h2>My player card <small>{dfmt(W.start)} to {dfmt(W.end)}. The team average is {AVG}. Your place is just for you.</small> <SecHelp k="cards" role="rep" /></h2>
        <div className="wins"><Win>last 90 days</Win></div>
      </div>
      <div className="pcards mine">
        {W.me ? <Card c={W.me} me /> : (
          <div className="pcard earning">
            <span className="label">Your card is on the way</span>
            <Unlock c={W.coming} />
            <p className="sub">You earn your card at {n0(W.coming.needed)} demos. {n0(Math.max(0, W.coming.needed - W.coming.demos))} to go. From then on you are rated on your real numbers, right alongside the team.</p>
          </div>
        )}
        <div className="powerboard">
          <span className="label">Power board</span>
          <ol className="podium">
            {W.top.map((x: any) => (
              <li key={x.rep} className={`${x.rank === 1 ? "first" : ""} ${x.rep === W.me?.rep ? "me" : ""}`}>
                <span><span className="place">{x.rank}</span>{x.rep}</span><span className="num">{x.power}</span>
              </li>
            ))}
          </ol>
          {W.me ? (W.me.rank > 3 ? <p className="sub">You are #{W.me.rank} of {W.count}. Raise your lowest skill to climb fastest.</p> : <p className="sub">You are in the top 3 of {W.count}.</p>) : null}
          <Records r={card.record} />
          <Targets t={W.targets} />
          <p className="explain">{card.how}</p>
        </div>
      </div>
    </section>
  );
}
