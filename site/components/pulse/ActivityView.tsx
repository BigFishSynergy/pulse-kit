"use client";
import { useState } from "react";
import type { DayLog } from "@/lib/pulse/activity";
import { PAGE_NAMES, summarize } from "@/lib/pulse/activity-summary";
import { Seg } from "./ui";
import { TZ } from "@/lib/pulse/config";

type Person = { u: string; name: string; role: "rep" | "lead" | "csr" };
type Range = { key: string; label: string; from: string; to: string };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ }) : "Not yet");
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export default function ActivityView({ logs, everyone, ranges }: { logs: DayLog[]; everyone: Person[]; ranges: Range[] }) {
  const [key, setKey] = useState(ranges[0].key);
  const [open, setOpen] = useState<string | null>(null);
  const R = ranges.find((r) => r.key === key)!;
  const sum = summarize(logs.filter((d) => d.day >= R.from && d.day <= R.to), everyone);
  const reps = sum.people.filter((p) => p.role !== "lead"), leads = sum.people.filter((p) => p.role === "lead");
  const days: string[] = [];
  for (let t = Date.parse(R.from + "T12:00:00Z"); t <= Date.parse(R.to + "T12:00:00Z"); t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
  const maxDay = Math.max(1, ...days.map((d) => sum.byDay[d] ?? 0));

  const Table = ({ rows, title }: { rows: typeof sum.people; title: string }) => (
    <section>
      <h2>{title}</h2>
      <div className="tbl"><table>
        <thead><tr><th>Person</th><th className="r">Days active</th><th className="r">Sign-ins</th><th className="r">Time on site</th><th>Most used</th><th className="r">Claude questions</th><th className="r">Graphics</th><th>Last seen</th></tr></thead>
        <tbody>{rows.map((p) => [
          <tr key={p.u} className={p.daysActive ? "" : "dim"}>
            <td className="m">{p.name}</td>
            <td className="r num">{p.daysActive || "–"}</td>
            <td className="r num">{p.signins || "–"}</td>
            <td className="r num">{p.minutes ? mins(p.minutes) : "–"}</td>
            <td>{p.topPages.map(([k, n]) => `${PAGE_NAMES[k] ?? k} (${n})`).join(", ") || "–"}</td>
            <td className="r num">{p.asks.length ? <button type="button" className="link" onClick={() => setOpen(open === p.u ? null : p.u)}>{p.asks.length} {open === p.u ? "▲" : "▼"}</button> : "–"}</td>
            <td className="r num">{p.graphics || "–"}</td>
            <td className="sub">{when(p.lastSeen)}</td>
          </tr>,
          open === p.u ? (
            <tr key={p.u + "-q"} className="subrow"><td colSpan={8}><ul className="mini">{p.asks.map((a, i) => <li key={i}><span>{a.q}</span><span className="sub">{when(a.at)}</span></li>)}</ul></td></tr>
          ) : null,
        ])}</tbody>
      </table></div>
    </section>
  );

  return (
    <>
      <section>
        <div className="sechead">
          <h2>Who&apos;s using the Pulse <small>{R.label}</small></h2>
          <Seg label="Period" value={key} options={ranges.map((r) => [r.key, r.label] as [string, string])} onChange={setKey} />
        </div>
        <div className="strip">
          <div><span className="label">People active</span><span className="big num">{sum.activeCount}<span className="sub" style={{ fontSize: 20 }}> of {sum.total}</span></span><span className="sub">signed in or used the site</span></div>
          <div><span className="label">Sign-ins</span><span className="big num">{sum.people.reduce((t, p) => t + p.signins, 0)}</span><span className="sub">passwords and sign-in links</span></div>
          <div><span className="label">Time on site</span><span className="big num">{mins(sum.minutes)}</span><span className="sub">active minutes, all people</span></div>
          <div><span className="label">Claude questions</span><span className="big num">{sum.asks}</span><span className="sub">tap a number below to read them</span></div>
        </div>
        <div className="chart">
          <svg viewBox={`0 0 ${Math.max(days.length, 1) * 30} 90`} role="img" aria-label="People active each day">
            {days.map((d, i) => {
              const v = sum.byDay[d] ?? 0, h = (v / maxDay) * 60;
              return <g key={d}><rect x={i * 30 + 4} y={70 - h} width={22} height={Math.max(h, 1)} fill={v ? "var(--neon)" : "var(--line)"}><title>{`${d}: ${v} people`}</title></rect>{days.length <= 14 ? <text x={i * 30 + 15} y={86} textAnchor="middle">{new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short" })}</text> : null}</g>;
            })}
          </svg>
        </div>
      </section>
      <Table rows={reps} title="Sales team (reps and CSRs)" />
      <Table rows={leads} title="Leadership" />
      <p className="explain">Time on site counts only minutes when the page is open on screen and someone has touched it in the last two minutes. Activity starts counting from the day the Pulse went live. You also get this as a Slack DM every Monday at 8 AM.</p>
    </>
  );
}
