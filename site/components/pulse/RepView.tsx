"use client";
import Link from "next/link";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bars, barStats } from "./charts";
import IslandMap from "./IslandMap";
import SecHelp, { PageHelp } from "./SecHelp";
import { MyCard } from "./PlayerCards";
import { MyMeter } from "./HotCold";
import RepDeals from "./RepDeals";
import { MyCosts } from "./JobCosting";
import { AskTeaser } from "./AskPage";
import { LEAD_HELP, REP_ASK, REP_HELP } from "./askChips";
import GraphicMaker from "./GraphicMaker";
import Welcome from "./Welcome";
import { ChangeChip, RateTxt, Seg, usePersist, Win } from "./ui";
import { dfmt, mlabel, money, moneyS, n0, n1, pct, tidy, written } from "@/lib/pulse/format";
import { county } from "@/lib/pulse/county";
import { CRM } from "@/lib/pulse/config";

// One sales rep's screen. Built to motivate: their own numbers against last year and the team,
// their trend, their map, their open quotes, one coaching card, and the top of each leaderboard.
// The server sends only this rep's file, so nothing here can reveal another rep's details.

const PER: [string, string][] = [["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]];

type Tile = { key: string; label: string; fmt: (v: any) => string; rate?: boolean };
const TILES: Tile[] = [
  { key: "sits", label: "Sits", fmt: n0 },
  { key: "jobs_sold", label: "Jobs sold", fmt: n0 },
  { key: "sales", label: "Sales", fmt: money },
  { key: "avg_ticket", label: "Avg ticket", fmt: money },
  { key: "close", label: "Close rate", fmt: (r) => (r?.pct == null ? "–" : pct(r.pct)), rate: true },
  { key: "self_gen_leads", label: "Self-gen leads", fmt: n0 },
];

function MyNumbers({ r, per, setPer }: { r: any; per: string; setPer: (v: string) => void }) {
  const P = r.periods[per];
  return (
    <section>
      <div className="sechead">
        <div><h2>My numbers <SecHelp k="mynumbers" role="rep" /></h2><div className="sub">{P.label}: {dfmt(P.start)} to {dfmt(P.end)} · last year {dfmt(P.ly_start)} to {dfmt(P.ly_end)}</div></div>
        <Seg label="Period" value={per} options={PER} onChange={setPer} />
      </div>
      <div className="strip six">
        {TILES.map((t) => {
          const me = P.me[t.key], ly = P.ly[t.key], team = P.team.per_rep[t.key];
          return (
            <div key={t.key}>
              <span className="label">{t.label}{t.rate && r.close_window ? <Win>last {r.close_window.days} days</Win> : null}</span>
              <span className="big num">{t.fmt(me)}</span>
              {t.rate && me?.d ? <span className="sub">{n0(me.n)} sold of {n0(me.d)} sits</span> : null}
              <span className="vs">
                <span>{t.rate ? <ChangeChip a={me?.pct} b={ly?.pct} points /> : <ChangeChip a={me} b={ly} />} vs {t.rate ? (ly?.d ? <RateTxt r={ly} /> : "–") : t.fmt(ly)} last year</span>
                <span>{t.rate ? <>Team: <RateTxt r={team} /></> : t.key === "avg_ticket" ? <>Team: {money(team)}</> : <>Team average per rep: {t.key === "sales" ? money(team) : n1(team)}</>}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="sub">Sits are quoted appointments. Close rate leaves out insurance, inspection, retail, service and warranty appointments and a few dead reasons, so its count of sits can be a little lower. Close rate goes by appointment date, so your newest appointments have not had time to buy yet.</p>
    </section>
  );
}

function Coach({ card, at }: { card: any; at?: string }) {
  if (!card) return null;
  return (
    <section>
      <h2>This week <small>One thing to remember, one win, one thing to sharpen</small> <SecHelp k="thisweek" role="rep" /></h2>
      {at ? <span className="written">{written(at)}. The numbers below update every hour.</span> : null}
      <div className="coach">
        <div><b className="tag">Takeaway</b><p>{tidy(card.takeaway)}</p></div>
        <div><b className="tag">Doing well</b><p>{tidy(card.win)}</p></div>
        <div><b className="tag">Next level</b><p>{tidy(card.improve)}</p></div>
      </div>
    </section>
  );
}

const BOARD_ORDER = ["jobs_sold", "sales", "close", "avg_ticket", "self_gen_leads", "most_improved"];
function boardVal(b: any, x: any) {
  if (b.fmt === "money") return money(x.value);
  if (b.fmt === "money_delta") return "+" + money(x.value);
  if (b.fmt === "rate") return <>{pct(x.value)} <span className="sub">({x.n} of {x.d})</span></>;
  return n0(x.value);
}

function Boards({ r, me, per, setPer }: { r: any; me: string; per: string; setPer: (v: string) => void }) {
  const B = r.boards[per];
  return (
    <section>
      <div className="sechead">
        <h2>Leaderboards <small>Top 3 on the team. Your own spot is just for you.</small> <SecHelp k="boards" role="rep" /></h2>
        <Seg label="Leaderboard period" value={per} options={PER} onChange={setPer} />
      </div>
      <div className="boards">
        {BOARD_ORDER.map((k) => {
          const b = B[k]; if (!b) return null;
          return (
            <div key={k}>
              <span className="label">{b.label}</span>
              {b.note ? <span className="sub">{b.note}</span> : null}
              {b.top.length ? (
                <ol className="podium">
                  {b.top.map((x: any) => (
                    <li key={x.rep} className={`${x.rank === 1 ? "first" : ""} ${x.rep === me ? "me" : ""}`}>
                      <span><span className="place">{x.rank}</span>{x.rep}</span><span className="num">{boardVal(b, x)}</span>
                    </li>
                  ))}
                </ol>
              ) : <span className="sub">Nobody on this board yet.</span>}
              <span className="myrank">
                {b.me ? <>Your spot: <b>#{b.me.rank}</b> of {b.ranked_count}{b.me.rank > 3 ? <> with {boardVal(b, b.me)}</> : null}</>
                  : b.me_waiting ? <>You need {b.me_waiting.needs.replace(" to qualify", "")} to get on this board.</>
                  : <>Not on this board yet. One {k === "self_gen_leads" ? "self-gen lead" : k === "most_improved" ? "good week" : "sale"} gets you on.</>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const TREND: { key: string; label: string; fmt: (v: any) => string; val: (p: any) => number }[] = [
  { key: "sales", label: "Sales", fmt: money, val: (p) => p.sales },
  { key: "jobs_sold", label: "Jobs sold", fmt: n0, val: (p) => p.jobs_sold },
  { key: "sits", label: "Sits", fmt: n0, val: (p) => p.sits },
  { key: "close", label: "Close rate", fmt: (v) => pct(v, 0), val: (p) => (p.close_d ? p.close_n / p.close_d : 0) },
];

function MyTrend({ r }: { r: any }) {
  const [mode, setMode] = usePersist("repTrend", "weekly", ["weekly", "monthly"]);
  const series: any[] = r.trend[mode];
  const labels = series.map((x) => (mode === "monthly" ? mlabel(x.start) : dfmt(x.start)));
  return (
    <section>
      <div className="sechead">
        <h2>My trend <small>{mode === "monthly" ? "Last 13 months plus this month so far" : "Last 13 weeks plus this week so far"}. Gray behind each bar is the same {mode === "monthly" ? "month" : "week"} last year.</small> <SecHelp k="mytrend" role="rep" /></h2>
        <Seg label="Trend period" value={mode} options={[["weekly", "Weekly"], ["monthly", "Monthly"]]} onChange={setMode} />
      </div>
      <div className="trend duo">
        {TREND.map((t) => {
          const vals = series.map((x) => t.val(x.cur)), ly = series.map((x) => t.val(x.ly));
          const st = barStats(vals, true);
          const lastFull = series[st.hiIdx];
          const extra = t.key === "close" ? ` (${lastFull.cur.close_n} of ${lastFull.cur.close_d})` : "";
          return (
            <div key={t.key}>
              <div className="head"><span className="label">{t.label}</span><span className="val num">{t.fmt(st.hi)}<span className="sub">{extra}</span></span></div>
              <Bars vals={vals} ly={ly} labels={labels} fmt={t.fmt} partialLast unit={mode === "monthly" ? "month" : "week"} title={t.label} />
              <span className="sub">Last full {mode === "monthly" ? "month" : "week"} vs your {st.n}-{mode === "monthly" ? "month" : "week"} average of {t.fmt === money ? moneyS(st.avg) : t.fmt(st.avg)} (red line). Same {mode === "monthly" ? "month" : "week"} last year: {t.fmt === money ? moneyS(ly[st.hiIdx]) : t.fmt(ly[st.hiIdx])}.</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FollowUps({ f }: { f: any }) {
  if (!f) return null;
  return (
    <section>
      <h2>My follow-ups <small>Quoted appointments from the last {f.window_days} days that have not sold yet, newest first. Open each one in {CRM}.</small> <SecHelp k="followups" role="rep" /></h2>
      <div className="tri">
        <div><span className="label">Still open</span><span className="big num">{n0(f.count)}</span><span className="sub">quoted appointments</span></div>
        <div><span className="label">Quoted value</span><span className="big num">{money(f.quoted_total)}</span><span className="sub">on the table right now</span></div>
        <div><span className="label">Newest</span><span className="big num">{f.rows[0] ? dfmt(f.rows[0].appt) : "–"}</span><span className="sub">{f.rows[0] ? `${f.rows[0].days} days ago` : "No open quotes"}</span></div>
      </div>
      {f.rows.length ? (
        <div className="tbl"><table>
          <thead><tr><th>Appointment</th><th>Town</th><th>Source</th><th>Rating</th><th>Status</th><th className="r">Quote</th><th>Record</th></tr></thead>
          <tbody>{f.rows.map((x: any, i: number) => (
            <tr key={i}>
              <td className="num">{dfmt(x.appt)} <span className="sub">{x.days === 0 ? "today" : `${x.days}d ago`}</span></td>
              <td>{x.town}{county(x.zip) && county(x.zip) !== "OUT" ? <span className="sub"> · {county(x.zip)}</span> : null}</td><td>{x.source}</td><td>{x.rating}</td><td>{x.status}</td>
              <td className="r num">{money(x.quote)}</td>
              <td>{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer">Open</a> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty-note">No open quotes. Nice work.</div>}
      {f.count > f.rows.length ? <p className="sub">Showing the newest {f.rows.length} of {f.count}.</p> : null}
    </section>
  );
}


export default function RepView({ r, card, cardAt, canAsk, viewer, week }: { r: any; card: any; cardAt?: string; canAsk: boolean; viewer: "rep" | "lead"; week?: string }) {
  const [per, setPer] = usePersist("repPer", "month", ["week", "month", "quarter", "year"]);
  const [bper, setBper] = usePersist("repBoardPer", "month", ["week", "month", "quarter", "year"]);
  const first = r.rep.split(" ")[0];
  return (
    <div className="simple-page">
      <PageHelp keys={["thisweek", "mynumbers", "meter", "boards", "cards", "costs", "mytrend", "map", "followups"]} role="rep" />
      {viewer === "rep" ? (() => {
        const b = r.boards?.month ?? {};
        const top = [["sales", "sales"], ["jobs_sold", "jobs sold"], ["close", "close rate"]].map(([k, l]) => (b[k]?.me ? { place: b[k].me.rank as number, board: l } : null)).filter(Boolean).sort((x: any, y: any) => x.place - y.place)[0] as any;
        return <Welcome first={first} role="rep" rank={top} openQuotes={r.follow_ups?.count ? { count: r.follow_ups.count, value: money(r.follow_ups.quoted_total) } : null} />;
      })() : null}
      {viewer === "lead" ? <div className="risk">Leadership view: this is {r.rep}&apos;s screen, exactly what the rep sees. <Link href={`/pulse/hq/pulse${week ? `?week=${week}` : ""}`}>Back to the Pulse</Link></div> : null}
      {viewer === "rep" ? (
        <section className="hello">
          <h2>{`${first}, here are your numbers`} <small>Your numbers, your map, your open quotes. Counted from {CRM} with the company&apos;s rules.</small></h2>
        </section>
      ) : null}
      <Coach card={card} at={cardAt} />
      <MyNumbers r={r} per={per} setPer={setPer} />
      <MyMeter meter={r.meter} viewer={viewer} />
      <section className="clean"><RepDeals r={r} viewer={viewer} /></section>
      <Boards r={r} me={r.rep} per={bper} setPer={setBper} />
      <MyCard card={r.card} />
      <MyCosts c={r.costs} />
      <MyTrend r={r} />
      <IslandMap geo={r.geo} rep title="My map" subtitle="Where you close best, where your tickets are biggest, where your open quotes are" />
      <FollowUps f={r.follow_ups} />
      {canAsk ? <AskTeaser href={viewer === "lead" ? `/pulse/hq/ask?rep=${r.slug}${week ? `&week=${week}` : ""}` : "/pulse/me/ask"} ask={REP_ASK} help={viewer === "lead" ? LEAD_HELP : REP_HELP}
        title={viewer === "lead" ? `Ask about ${r.rep}'s numbers` : "Ask Claude"} note={viewer === "lead" ? "Opens Ask Claude set to this rep's screen" : "About your numbers, or how to use anything here. Every chat is saved for you."} /> : null}
      {canAsk ? <GraphicMaker scope={viewer} rep={viewer === "lead" ? r.slug : undefined} /> : null}
    </div>
  );
}
