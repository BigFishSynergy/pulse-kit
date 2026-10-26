"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import SecHelp from "./SecHelp";
import { dfmt, n0 } from "@/lib/pulse/format";

// The hot and cold meter (site/pipeline/meter.py): how many of a rep's last 10 demos sold, as a temperature.
// Leadership sees every rep; a rep's own screen shows only their own meter.
// Each row leads with the plain sentence ("6 of the last 10 demos sold") and the badge; the 120-day strip is behind
// Show history. Badges are plain text everywhere; only the rep's own big badge keeps its emoji.

export const LABEL: Record<string, string> = { fire: "On fire", hot: "Hot", warm: "Warm", cold: "Cold", ice: "Ice cold", break: "On break" };
const ICON: Record<string, string> = { fire: "🔥", hot: "", warm: "", cold: "", ice: "🧊", break: "" };
const STRIP = ["ice", "cold", "warm", "hot", "fire"];
const NEXT: [string, number][] = [["cold", 2], ["warm", 3], ["hot", 5], ["fire", 6]];

export function MeterBadge({ level, sold, small, icon }: { level?: string | null; sold?: number; small?: boolean; icon?: boolean }) {
  if (!level) return <span className={`meter none${small ? " small" : ""}`}>Starts at 10 demos</span>;
  return (
    <span className={`meter ${level}${small ? " small" : ""}`} title={sold != null ? `${sold} of the last 10 demos sold` : undefined}>
      {icon && ICON[level] ? <i aria-hidden="true">{ICON[level]}</i> : null}{LABEL[level]}
    </span>
  );
}

/** One square per day, oldest on the left, colored by that day's level. */
export function MeterStrip({ strip, start }: { strip: string; start: string }) {
  const t0 = Date.parse(start + "T12:00:00Z");
  return (
    <span className="mstrip" role="img" aria-label="Meter by day, oldest first">
      {strip.split("").map((c, i) => {
        const day = new Date(t0 + i * 864e5).toISOString().slice(0, 10);
        const k = c === "-" ? "" : c === "b" ? "break" : STRIP[+c];
        return <i key={i} className={k || "none"} title={`${dfmt(day)}: ${k ? LABEL[k] : "under 10 demos"}`} />;
      })}
    </span>
  );
}

function Legend() {
  return (
    <ul className="mlegend">
      <li><MeterBadge level="fire" small /> 6+ of 10</li>
      <li><MeterBadge level="hot" small /> 5</li>
      <li><MeterBadge level="warm" small /> 3 or 4</li>
      <li><MeterBadge level="cold" small /> 2</li>
      <li><MeterBadge level="ice" small /> 0 or 1</li>
      <li><MeterBadge level="break" small /> no demos in 10 days</li>
    </ul>
  );
}

/** Leadership: every rep's meter, hottest first. The last 120 days are behind Show history. */
export default function HotColdBoard({ meter, week }: { meter: any; week?: string }) {
  if (!meter?.reps?.length) return null;
  return (
    <section id="meter">
      <div className="sechead">
        <h2>Hot and cold <small>Out of each rep&apos;s last 10 demos, how many sold. Every contract signed since the 10th demo counts, so a rep heats up the day they sign. Reps only ever see their own.</small> <SecHelp k="meter" /></h2>
      </div>
      <div className="mboard">
        {meter.reps.map((r: any) => (
          <div key={r.rep} className="mrow">
            <Link className="mname" href={`/pulse/hq/rep/${r.slug}${week ? `?week=${week}` : ""}`}>{r.rep}</Link>
            <span className="mnum">{r.level ? <><b className="num">{r.sold} of the last 10</b> demos sold <span className="sub">{n0(r.days_at_level)} {r.days_at_level === 1 ? "day" : "days"} at this level</span></> : <span className="sub">{n0(r.demos)} demos so far, {n0(r.needs)} to go</span>}</span>
            <MeterBadge level={r.level} sold={r.sold} />
          </div>
        ))}
      </div>
      <details className="mhistory">
        <summary>Show history <span className="c">Each rep&apos;s last 120 days, one square per day</span></summary>
        <Legend />
        <div className="mboard">
          {meter.reps.map((r: any) => (
            <div key={r.rep} className="mrow hist">
              <span className="mname">{r.rep}</span>
              <span className="mhist"><MeterStrip strip={r.strip} start={meter.strip_start} /><span className="sub">{r.longest_on_fire ? `Longest on fire: ${r.longest_on_fire} ${r.longest_on_fire === 1 ? "day" : "days"}` : "No on-fire run yet"}</span></span>
            </div>
          ))}
        </div>
      </details>
      <p className="explain">{meter.how}</p>
    </section>
  );
}

/** A rep's own meter. Only their own; nobody else's level is in their file. */
export function MyMeter({ meter, viewer = "rep" }: { meter: any; viewer?: "rep" | "lead" }) {
  const me = meter?.me;
  if (!me) return null;
  const next = me.level && me.level !== "break" ? NEXT.find(([, at]) => at > me.sold) : null;
  const you = viewer === "rep" ? "your" : "their";
  return (
    <section id="mymeter" className="mymeter">
      <div className="sechead">
        <h2>{viewer === "rep" ? "My meter" : "Hot and cold"} <small>Out of {you} last 10 demos, how many sold. {viewer === "rep" ? "Just for you." : "The rep sees only their own."}</small> <SecHelp k="meter" role="rep" /></h2>
      </div>
      <div className="mme">
        <div className="mme-t">
          {me.level ? (
            <>
              <span className="mme-n"><b className="num">{me.sold} of {you} last 10</b> demos sold</span>
              <span className="sub">
                {me.level === "ice" || me.level === "cold" ? "Due for one. " : ""}
                {me.level === "fire" ? "Top of the meter. Keep it rolling." : me.level === "break" ? "No demos in 10 days. It picks up again with the next one." : next ? `${next[1] - me.sold} more signed ${next[1] - me.sold === 1 ? "deal" : "deals"} gets ${viewer === "rep" ? "you" : "them"} to ${LABEL[next[0]]} (${next[1]} of 10).` : ""}
              </span>
            </>
          ) : <span className="sub">The meter starts after 10 demos. {n0(me.demos)} so far, {n0(me.needs)} to go.</span>}
        </div>
        <MeterBadge level={me.level} sold={me.sold} icon={viewer === "rep"} />
      </div>
      <details className="mhistory">
        <summary>Show history <span className="c">Last 120 days, oldest on the left</span></summary>
        <div className="mme-hist"><MeterStrip strip={me.strip} start={meter.strip_start} /><span className="sub">{me.longest_on_fire ? `Longest on-fire run: ${me.longest_on_fire} ${me.longest_on_fire === 1 ? "day" : "days"}.` : ""}</span></div>
        <Legend />
      </details>
    </section>
  );
}
