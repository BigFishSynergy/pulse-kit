"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Win } from "./ui";
import { n0, pct } from "@/lib/pulse/format";

// Two panels on a rep's screen, both over the last 90 days, built in site/pipeline/deals.py:
//   Same-day closes      demos that signed the day they were held, with the team's top 3
//   Why deals got away   the dead reasons on demos that did not sign, and how many are still open to follow up

export default function RepDeals({ r, viewer }: { r: any; viewer: "rep" | "lead" }) {
  const sd = r.same_day, lost = r.lost;
  if (!sd && !lost) return null;
  const you = viewer === "rep";
  const most = lost?.reasons?.[0]?.n ?? 0;
  return (
    <>
      {sd ? (
        <div className="cl-panel">
          <div className="cl-panel-h"><span className="cl-k">Same-day closes</span><Win>last {sd.days} days</Win><span className="sub">Demos that signed the day they were held</span></div>
          <div className="cl-pow-row">
            <span className="cl-pow big"><b className="num">{sd.pct == null ? "–" : pct(sd.pct, 0)}</b><small>{n0(sd.n)} of {n0(sd.of)}</small></span>
            <div>
              <span className="sub">Team: <b>{pct(sd.team.pct, 0)}</b> ({n0(sd.team.n)} of {n0(sd.team.of)})</span>
              <span className="sub">{sd.rank ? <>{you ? "Your" : "Their"} spot: <b>#{sd.rank}</b> of {sd.ranked_count}</> : sd.of < sd.min_demos ? <>On the board after {sd.min_demos} demos in {sd.days} days</> : <>Not on the board yet. One same-day close gets {you ? "you" : "them"} on.</>}</span>
            </div>
          </div>
          {sd.top?.length ? (
            <ol className="podium">
              {sd.top.map((x: any) => (
                <li key={x.rep} className={`${x.rank === 1 ? "first" : ""} ${x.rep === r.rep ? "me" : ""}`}>
                  <span><span className="place">{x.rank}</span>{x.rep}</span><span className="num">{pct(x.pct, 0)} <span className="sub">{n0(x.n)}/{n0(x.of)}</span></span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
      {lost ? (
        <div className="cl-panel">
          <div className="cl-panel-h"><span className="cl-k">Why deals got away</span><Win>last {lost.days} days</Win><span className="sub">{you ? "Your" : "Their"} {n0(lost.demos)} demos: {n0(lost.signed)} signed, {n0(lost.dead)} lost, {n0(lost.open)} still open</span></div>
          {lost.reasons?.length ? (
            <ul className="lost">
              {lost.reasons.map((x: any) => (
                <li key={x.reason}>
                  <span className="nm">{x.reason}</span>
                  <span className="bar"><i style={{ width: `${Math.max(4, (x.n / most) * 100)}%` }} /></span>
                  <span className="num">{n0(x.n)}</span>
                </li>
              ))}
            </ul>
          ) : <span className="sub">No lost demos in the last {lost.days} days.</span>}
          {lost.open ? <span className="sub">{n0(lost.open)} {lost.open === 1 ? "demo is" : "demos are"} still open. {you ? "Those are your best follow-ups." : "Those are the best follow-ups."}</span> : null}
        </div>
      ) : null}
    </>
  );
}
