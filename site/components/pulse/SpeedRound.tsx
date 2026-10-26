"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { dfmt, n0 } from "@/lib/pulse/format";
import { CO } from "@/lib/pulse/config";
import { SPEED_TOPICS } from "@/lib/pulse/speedTopics";
const TOPICS = SPEED_TOPICS.join(", ") || "the company's own material";

// The weekly Speed Round: ten questions, one game a week, a leaderboard that resets every Monday.
// The server holds the answers and the clock; this screen only shows a question, counts down and sends the pick.

type PubQ = { i: number; n: number; kind: "know" | "hunt"; topic: string; question: string; choices: string[]; seconds: number; msLeft: number };
type Row = { rank: number; u: string; name: string; role: string; score: number; right: number; n: number; secs: number };
type Reveal = { correct: boolean; late: boolean; answer: number; why: string; points: number; picked: number | null };

function Board({ s }: { s: any }) {
  return (
    <aside className="sr-board">
      <span className="label">This week&apos;s leaderboard <span className="sub">{n0(s.players)} played · resets Monday</span></span>
      {s.board?.length ? (
        <ol className="podium">
          {s.board.map((r: Row) => (
            <li key={r.u} className={`${r.rank === 1 ? "first" : ""} ${s.me?.u === r.u ? "me" : ""}`}>
              <span><span className="place">{r.rank}</span>{r.name}</span><span className="num">{n0(r.score)} <span className="sub">{r.right}/{r.n}</span></span>
            </li>
          ))}
        </ol>
      ) : <p className="sub">Nobody has played yet. Be first on the board.</p>}
      {s.me && s.me.rank > 10 ? <p className="sub">You are #{s.me.rank} with {n0(s.me.score)}.</p> : null}
      {s.lastWeek?.length ? (
        <>
          <span className="label">Last week&apos;s top 3</span>
          <ol className="podium">{s.lastWeek.map((r: Row) => <li key={r.u} className={r.rank === 1 ? "first" : ""}><span><span className="place">{r.rank}</span>{r.name}</span><span className="num">{n0(r.score)}</span></li>)}</ol>
        </>
      ) : null}
    </aside>
  );
}

export default function SpeedRound({ reportsHref }: { reportsHref: string }) {
  const [s, setS] = useState<any>(null);
  const [q, setQ] = useState<PubQ | null>(null);
  const [left, setLeft] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const deadline = useRef(0);
  const sent = useRef(false);

  const load = () => fetch("/pulse/api/quiz").then((r) => r.json()).then((j) => { setS(j); setScore(j.score ?? 0); }).catch(() => setErr("The game could not load. Reload the page."));
  useEffect(() => { load(); }, []);

  async function serve() {
    setBusy(true); setErr(""); setReveal(null);
    const j = await fetch("/pulse/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (!j.current) { setErr(j.error || "Could not start. Try again."); load(); return; }
    sent.current = false;
    deadline.current = Date.now() + j.current.msLeft;
    setLeft(j.current.msLeft);
    setQ(j.current);
    setScore(j.score ?? 0);
  }

  async function pick(choice: number | null) {
    if (!q || sent.current) return;
    sent.current = true;
    setBusy(true);
    const j = await fetch("/pulse/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "answer", i: q.i, choice }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.answer == null) { setErr(j.error || "That answer did not go through."); load(); setQ(null); return; }
    setReveal({ correct: j.correct, late: j.late, answer: j.answer, why: j.why, points: j.points, picked: choice });
    setScore(j.score);
    if (j.done) setS((x: any) => ({ ...x, ...j, status: "done" }));
  }

  // the countdown; at zero the pick goes in empty
  useEffect(() => {
    if (!q || reveal) return;
    const t = setInterval(() => {
      const ms = Math.max(0, deadline.current - Date.now());
      setLeft(ms);
      if (ms <= 0) { clearInterval(t); pick(null); }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, reveal]);

  if (err && !s) return <div className="state"><h2>{err}</h2></div>;
  if (!s) return <div className="state"><h2>Loading the Speed Round</h2></div>;
  if (!s.ready) return <div className="sr"><section className="sr-lobby"><h2>Speed Round <small>Week of {dfmt(s.week)}</small></h2><p>This week&apos;s questions are being written. Check back soon.</p></section><Board s={s} /></div>;

  // playing: a question, or the answer to the last one
  if (q) {
    const done = s.status === "done" && reveal;
    return (
      <div className="sr">
        <section className="sr-play" aria-live="polite">
          <div className="sr-top">
            <span className="label">Question {q.i + 1} of {q.n} · {q.topic}</span>
            <span className="num sr-score">{n0(score)} pts</span>
          </div>
          {!reveal ? <div className="sr-clock" role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}><i style={{ width: `${(left / (q.seconds * 1000)) * 100}%` }} /><span className="num">{Math.ceil(left / 1000)}</span></div> : null}
          <h3 className="sr-q">{q.question}</h3>
          {q.kind === "hunt" && !reveal ? <p className="sub">Report hunt: <a href={reportsHref} target="_blank" rel="noreferrer">open {reportsHref.includes("/me/") ? "My reports" : "Reports"} in a new tab</a>, set it up as the question says, find the answer, come back and pick it. You have {q.seconds / 60} minutes.</p> : null}
          <div className="sr-choices">
            {q.choices.map((c, i) => {
              const cls = reveal ? (i === reveal.answer ? "right" : i === reveal.picked ? "wrong" : "dim") : "";
              return <button key={i} type="button" className={cls} disabled={busy || !!reveal} onClick={() => pick(i)}><span className="k">{"ABCD"[i]}</span>{c}</button>;
            })}
          </div>
          {reveal ? (
            <div className={`sr-reveal ${reveal.correct ? "sr-good" : "sr-bad"}`}>
              <strong>{reveal.correct ? `Right! +${reveal.points}` : reveal.late || reveal.picked == null ? "Time ran out" : "Not this time"}</strong>
              <p>{reveal.why}</p>
              {done ? <button type="button" className="btn primary" onClick={() => { setQ(null); setReveal(null); load(); }}>See your score</button>
                : <button type="button" className="btn primary" onClick={serve} disabled={busy}>Next question</button>}
            </div>
          ) : null}
          {err ? <p className="sub">{err}</p> : null}
        </section>
      </div>
    );
  }

  if (s.status === "done") {
    const right = (s.review ?? []).filter((x: any) => x.correct).length || s.me?.right;
    return (
      <div className="sr">
        <section className="sr-lobby">
          <h2>Speed Round <small>Week of {dfmt(s.week)}. You played this week.</small></h2>
          <div className="sr-final"><span className="huge num">{n0(s.score ?? s.me?.score)}</span><span className="sub">points · {right ?? "–"} of {s.n} right{s.me ? ` · #${s.me.rank} of ${s.players}` : ""}</span></div>
          <p className="sub">New questions every Monday. One game a week, so make it count.</p>
          {s.review?.length ? (
            <details className="rb-more"><summary>Review your answers</summary>
              <ol className="sr-review">{s.review.map((x: any) => (
                <li key={x.i} className={x.correct ? "sr-good" : "sr-bad"}>
                  <span className="label">{x.topic}</span><b>{x.question}</b>
                  <span>Answer: {x.choices[x.answer]}{x.correct ? ` · +${x.points}` : x.choice == null ? " · time ran out" : ` · you picked ${x.choices[x.choice]}`}</span>
                  <span className="sub">{x.why}</span>
                </li>
              ))}</ol>
            </details>
          ) : null}
        </section>
        <Board s={s} />
      </div>
    );
  }

  return (
    <div className="sr">
      <section className="sr-lobby">
        <h2>Speed Round <small>Week of {dfmt(s.week)}. {s.n} questions.</small></h2>
        <ul className="sr-rules">
          <li><b>One game a week.</b> Your first game is the one that counts. New questions every Monday.</li>
          <li><b>15 seconds a question</b>, all from memory, on what {CO.short_name} picked for it: {TOPICS}.</li>
          <li><b>100 points</b> for every right answer, up to <b>50 more</b> for speed.</li>
        </ul>
        <button type="button" className="btn primary sr-go" onClick={serve} disabled={busy}>{s.status === "playing" ? `Pick up at question ${(s.at ?? 0) + 1}` : "Start the Speed Round"}</button>
        {err ? <p className="sub">{err}</p> : null}
      </section>
      <Board s={s} />
    </div>
  );
}
