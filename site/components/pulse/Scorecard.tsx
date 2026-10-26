"use client";
import { useMemo, useState } from "react";
import { dfmt, money, moneyK, n0, pct } from "@/lib/pulse/format";
import { Seg, usePersist } from "./ui";
import { TZ } from "@/lib/pulse/config";
import { CONFIG, CRM } from "@/lib/pulse/config";

/* eslint-disable @typescript-eslint/no-explicit-any */

// The leadership Scorecard: a board of boxes, not a long table. On top, the three things to fix
// (the first is "Fix this first") and which manager is on red alert. Then the boxes in three groups. Every number,
// goal and status comes from the data job (pipeline/scoreboard.py), which checks the week against the rules' scorecard().
// Cash is the one number typed in here.

type Tile = any;
type Cash = { amount: number; at: string; name: string } | null;

const PER: [string, string][] = [["week", "Week"], ["month", "Month"], ["quarter", "Quarter"]];
const GROUPS: { title: string; keys: string[]; cols: number }[] = [
  { title: "Sales", keys: ["appts", "sit_rate", "appts_30", "demos", "sales", "close", "ticket"], cols: 4 },
  { title: "Production", keys: ["backlog", "revenue", "gp"], cols: 3 },
  { title: "Money and reviews", keys: ["cash", "ar30", "reviews"], cols: 3 },
];
const OWNERS = CONFIG.people.leadership.map((p) => p.name);
const HIST: Record<string, string> = { week: "Last 13 weeks", month: "Last 6 months", quarter: "Last 4 quarters" };

function fmt(t: Tile, v: number | null | undefined) {
  if (v == null) return "–";
  if (t.fmt === "count") return n0(v);
  if (t.fmt === "rate") return pct(v, 0);
  if (t.fmt === "pct") return pct(v, 1);
  if (t.key === "ticket") return money(v);
  return moneyK(v);
}

/** The status words on each box. */
function say(t: Tile, per: string) {
  if (!t.status) return "";
  if (t.key === "backlog") return t.status === "good" ? "In range" : t.value < t.low ? "Too low: sell more" : "Too high: add crews";
  if (t.less) return t.status === "good" ? "Under the limit" : t.status === "near" ? "Just over" : "Over the limit";
  if (t.pace != null) {
    const done = per === "week";
    return t.status === "good" ? (done ? "Met goal" : "On pace") : t.status === "near" ? "Close" : done ? "Missed goal" : "Behind";
  }
  return t.status === "good" ? "Meets goal" : t.status === "near" ? "Near goal" : "Below goal";
}

/** The goal line under the big number. */
function goalLine(t: Tile, per: string, label: string) {
  if (t.key === "backlog") return t.low ? `Green from ${moneyK(t.low)} to ${moneyK(t.high)}` : "";
  if (t.goal == null) return "";
  if (t.less) return `Goal ${fmt(t, t.goal)} or less`;
  if (t.key === "cash") return `Goal ${moneyK(t.goal)} or more`;
  if (t.pace != null && per !== "week" && t.goal_full != null) return `Goal so far ${fmt(t, t.goal)}. ${label.replace(" so far", "")}: ${fmt(t, t.goal_full)}`;
  return `Goal ${fmt(t, t.goal)}`;
}

/** "55 vs a goal of 74", for the alert boxes. */
function versus(t: Tile) {
  if (t.key === "backlog") return `${t.weeks} weeks of work sold ahead (green is 3 to 5)`;
  if (t.key === "cash") return `${moneyK(t.value)} vs a goal of ${moneyK(t.goal)}`;
  if (t.less) return `${fmt(t, t.value)} vs a limit of ${fmt(t, t.goal)}`;
  return `${fmt(t, t.value)} vs a goal of ${fmt(t, t.goal)}`;
}

function Spark({ vals, status }: { vals: (number | null)[]; status?: string }) {
  const pts = vals.map((v, i) => [i, v] as const).filter(([, v]) => v != null) as [number, number][];
  if (pts.length < 2) return null;
  const ys = pts.map(([, v]) => v), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1, n = vals.length - 1 || 1;
  const xy = pts.map(([i, v]) => [(i / n) * 100, 27 - ((v - lo) / span) * 24] as const);
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg className="sc-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={xy.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")} fill="none" vectorEffect="non-scaling-stroke" />
      <path className={`dot ${status ?? ""}`} d={`M${lx.toFixed(2)},${ly.toFixed(2)}h0`} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function CloseBox({ t, per, label }: { t: Tile; per: string; label: string }) {
  const reps: any[] = t.reps ?? [];
  const top = Math.max(0.6, ...reps.map((r) => r.pct ?? 0));
  const at = (v: number) => `${Math.min(100, (v / top) * 100).toFixed(1)}%`;
  return (
    <div className="sc-reps" role="list" aria-label="Close rate by rep">
      {reps.map((r) => (
        <div key={r.rep} className="sc-rep" role="listitem">
          <span className="sc-rep-n">{r.rep}</span>
          <span className="sc-bar" aria-hidden="true">
            {r.pct != null ? <i className={r.status ?? "plain"} style={{ width: at(r.pct) }} /> : null}
            {t.goal != null ? <b style={{ left: at(t.goal) }} /> : null}
          </span>
          <span className={`sc-rep-v num ${r.status ?? ""}`}>{r.d ? pct(r.pct, 0) : "–"}</span>
          <span className="sc-rep-c num">{r.d ? `${r.n} of ${r.d}` : "no demos"}</span>
        </div>
      ))}
      {t.company?.d ? (
        <p className="sc-company">Company, everyone who sold: <b className="num">{pct(t.company.pct, 0)}</b> ({t.company.n} of {t.company.d}). For comparison, no goal color.</p>
      ) : null}
      <p className="sc-note">{per === "week" ? `The 30 days ending ${dfmt(t.window?.end)}.` : `${label}.`} A rep needs 5 demos before getting a color. The line marks the {pct(t.goal, 0)} goal.</p>
    </div>
  );
}

function CashBox({ t, canEdit, onSaved }: { t: Tile; canEdit: boolean; onSaved: (c: Cash) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/pulse/api/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: v }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That didn't save. Try again.");
      onSaved(j.latest);
      setOpen(false);
      setV("");
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="sc-sub">{t.at ? `Typed in by ${t.by}, ${new Date(t.at).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" })}. Not in ${CRM}.` : `Not in ${CRM}. Type in the bank balance each Monday.`}</p>
      {canEdit ? (
        open ? (
          <form className="sc-cash" onSubmit={save}>
            <label htmlFor="sc-cash-v">Cash in the bank today</label>
            <div>
              <input id="sc-cash-v" inputMode="decimal" autoComplete="off" placeholder="712,500" value={v} onChange={(e) => setV(e.target.value)} />
              <button type="submit" className="btn primary" disabled={busy || !v.trim()}>{busy ? "Saving" : "Save"}</button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
            {err ? <p className="sc-err" role="alert">{err}</p> : null}
          </form>
        ) : (
          <button type="button" className="btn sc-cash-btn" onClick={() => setOpen(true)}>{t.value != null ? "Update cash" : "Type in cash"}</button>
        )
      ) : null}
    </>
  );
}

function Box({ t, per, label, canEdit, onCash }: { t: Tile; per: string; label: string; canEdit: boolean; onCash: (c: Cash) => void }) {
  const wide = t.key === "close";
  return (
    <section className={`sc-box ${t.status ?? "none"}${wide ? " wide" : ""}`} aria-label={t.label}>
      <header>
        <h3>{t.label}</h3>
        {t.owner ? <span className="sc-owner">{t.owner}</span> : null}
      </header>
      <div className="sc-main">
        <span className="sc-big num">{t.key === "backlog" ? moneyK(t.value) : fmt(t, t.value)}</span>
        {t.key === "backlog" && t.weeks != null ? <span className="sc-weeks num">{t.weeks} weeks</span> : null}
        {t.status ? <span className={`chip ${t.status}`}>{say(t, per)}</span> : null}
      </div>
      {goalLine(t, per, label) ? <p className="sc-goal">{goalLine(t, per, label)}</p> : null}
      {t.key === "backlog" && t.low ? (
        <div className="sc-band" aria-hidden="true">
          <span className="sc-band-ok" style={{ left: "37.5%", width: "25%" }} />
          <i style={{ left: `${Math.min(100, Math.max(0, (t.weeks / 8) * 100))}%` }} />
          <small style={{ left: "37.5%" }}>3</small><small style={{ left: "62.5%" }}>5 weeks</small>
        </div>
      ) : null}
      {t.key === "cash" ? <CashBox t={t} canEdit={canEdit} onSaved={onCash} /> : t.sub ? <p className="sc-sub">{t.sub}</p> : null}
      {wide ? <CloseBox t={t} per={per} label={label} /> : null}
      {t.hist ? <div className="sc-trend"><Spark vals={t.hist} status={t.status} /><small>{t.window && per === "week" && t.key !== "appts_30" ? "30 days ending each Sunday" : t.key === "appts_30" ? "30 days ending each Sunday" : HIST[per]}</small></div> : null}
      {t.snap ? <p className="sc-snap">Right now, as of the last data pull</p> : null}
    </section>
  );
}

export default function Scorecard({ sb, cash: cash0, canEdit }: { sb: any; cash: Cash; canEdit: boolean }) {
  const [per, setPer] = usePersist("sc.per", "week", ["week", "month", "quarter"]);
  const [cash, setCash] = useState<Cash>(cash0);
  const P = sb.periods[per];

  const tiles: Tile[] = useMemo(() => {
    const goal = sb.cash_goal as number;
    let c: Tile = { key: "cash", label: "Cash balance", owner: sb.cash_owner, fmt: "money", goal, snap: true };
    if (cash) {
      const st = cash.amount >= goal ? "good" : cash.amount >= goal * 0.9 ? "near" : "bad";
      c = { ...c, value: cash.amount, status: st, sev: st === "good" ? 0 : 1 - cash.amount / goal, at: cash.at, by: cash.name.split(" ")[0],
        action: `Cash is under ${moneyK(goal)}. Go over what's coming in and going out this week.` };
    }
    return [...P.tiles, c];
  }, [P, cash, sb.cash_goal, sb.cash_owner]);
  const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]));

  const alerts = tiles
    .filter((t) => t.status === "bad" || t.status === "near")
    .sort((a, b) => (a.status === b.status ? (b.sev ?? 0) - (a.sev ?? 0) : a.status === "bad" ? -1 : 1))
    .slice(0, 3);
  const owners = OWNERS.map((o) => {
    const mine = tiles.filter((t) => t.owner === o);
    return { o, red: mine.filter((t) => t.status === "bad").length, close: mine.filter((t) => t.status === "near").length, n: mine.length };
  }).filter((x) => x.n);

  return (
    <div className="sc">
      <div className="sc-top">
        <div>
          <h2>{P.label}<small>{dfmt(P.start)} to {dfmt(P.end)}</small></h2>
          <p className="sub">{per === "week" ? "The last full Monday to Sunday, like the weekly scorecard. Close rate, ticket and GP use the 30 days ending that Sunday." : "So far, against the goal for the days that have passed."}</p>
        </div>
        <Seg label="Period" value={per} options={PER} onChange={setPer} />
      </div>

      <section className="sc-alerts" aria-label="What to fix">
        {alerts.length ? alerts.map((t, i) => (
          <article key={t.key} className={`sc-alert ${t.status}${i === 0 ? " first" : ""}`}>
            <span className="sc-alert-k">{i === 0 ? "Fix this first" : `Then #${i + 1}`}</span>
            <h3>{t.label}<span className="sc-owner">{t.owner}</span></h3>
            <p className="sc-alert-v">{versus(t)}</p>
            {t.action ? <p className="sc-alert-a">{t.action}</p> : null}
          </article>
        )) : (
          <article className="sc-alert good first">
            <span className="sc-alert-k">All clear</span>
            <h3>Every box is on goal</h3>
            <p className="sc-alert-a">Nothing is red or close. Keep doing what you&apos;re doing.</p>
          </article>
        )}
      </section>

      <div className="sc-redalert" aria-label="Red alert by manager">
        <span className="sc-redalert-k">Red alert</span>
        {owners.map((x) => (
          <span key={x.o} className={`sc-who ${x.red ? "bad" : x.close ? "near" : "good"}`}>
            <b>{x.o}</b>{x.red ? ` ${x.red} red` : ""}{x.red && x.close ? "," : ""}{x.close ? ` ${x.close} close` : ""}{!x.red && !x.close ? " all green" : ""}
          </span>
        ))}
      </div>

      {GROUPS.map((g) => (
        <section key={g.title} className="sc-group" aria-label={g.title}>
          <h2>{g.title}</h2>
          <div className={`sc-grid c${g.cols}`}>
            {g.keys.filter((k) => byKey[k]).map((k) => (
              <Box key={k} t={byKey[k]} per={per} label={P.label} canEdit={canEdit} onCash={setCash} />
            ))}
          </div>
        </section>
      ))}
      <p className="sc-foot sub">Owners and goals come from the scorecard in the rules and the goals. Backlog is green from 3 to 5 weeks of the weekly revenue goal: under 3, sell more; over 5, add crews. Close rate is graded for today&apos;s sales team only.</p>
    </div>
  );
}
