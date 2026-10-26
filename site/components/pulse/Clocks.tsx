"use client";
import SecHelp from "./SecHelp";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { LineChart, YearSwatch, type YearSeries } from "./charts";
import { Seg, usePersist } from "./ui";
import { dfmt, MON, n0, pct } from "@/lib/pulse/format";

// Cycle time clocks: one big lead-to-completed clock, a clock for each step, and a by-month chart with one line per
// year so busy-season creep shows up. Numbers come from site/pipeline/cycle.py (the rules, median days).

const WIN: [string, string][] = [["30", "30 days"], ["90", "90 days"], ["365", "12 months"]];
const SMALL_KEYS = ["lead_to_appt", "lead_to_sit", "appt_to_sale", "sit_to_sale", "sale_to_done"];
const days = (v: number | null | undefined) => (v == null ? "–" : v === 0 ? "Same day" : `${n0(v)} day${v === 1 ? "" : "s"}`);

function Spark({ pts }: { pts: (number | null)[] }) {
  const vals = pts.filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const W = 120, H = 28, max = Math.max(1, ...vals), min = Math.min(...vals);
  const X = (i: number) => (i / (pts.length - 1)) * W, Y = (v: number) => H - 2 - ((v - min) / Math.max(max - min, 1)) * (H - 4);
  let d = "";
  pts.forEach((v, i) => { if (v != null) d += `${d ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; });
  const last = pts.length - 1, lv = pts[last];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Last 13 months">
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth={1.5} />
      {lv != null ? <circle cx={X(last)} cy={Y(lv)} r={3} fill="var(--fg)" /> : null}
    </svg>
  );
}

export default function CycleClocks({ c }: { c: any }) {
  const [win, setWin] = usePersist("cycleWin", "90", WIN.map((w) => w[0]));
  const [step, setStep] = useState("lead_to_done");
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const W = c?.windows?.[win];
  const label = (k: string) => c.steps.find((s: any) => s.key === k)?.label ?? k;
  const full = useMemo(() => (c?.monthly ?? []).filter((m: any) => !m.partial), [c]);
  const last13 = full.slice(-13);

  // one line per year, January to December, for the chosen step (or how busy the month was)
  const chart = useMemo((): { data: YearSeries; years: number[]; note: string } | null => {
    if (!full.length) return null;
    const series: Record<number, [number, number][]> = {};
    const byMon: Record<number, number[]> = {};
    full.forEach((m: any) => {
      const y = +m.month.slice(0, 4), mo = +m.month.slice(5, 7);
      const v = step === "busy" ? m.busy.jobs_sold : (m.steps[step]?.n ?? 0) >= 5 ? m.steps[step].median : null;
      if (v == null) return;
      (series[y] = series[y] || []).push([mo, v]);
      (byMon[mo] = byMon[mo] || []).push(v);
    });
    const avg = Object.entries(byMon).map(([mo, vs]) => [+mo, vs.reduce((a, b) => a + b, 0) / vs.length] as [number, number]).sort((a, b) => b[1] - a[1]);
    const years = Object.keys(series).map(Number).sort();
    const span = years.length > 1 ? `${years[0]} to ${years[years.length - 1]}` : `${years[0]}`;
    const note = avg.length >= 6
      ? step === "busy"
        ? `Across ${span}, the busiest month for jobs sold is ${MON[avg[0][0] - 1]} (about ${n0(avg[0][1])} a month) and the slowest is ${MON[avg[avg.length - 1][0] - 1]} (about ${n0(avg[avg.length - 1][1])}).`
        : `Across ${span}, ${label(step).toLowerCase()} runs longest in ${MON[avg[0][0] - 1]} (${n0(avg[0][1])} days typical) and shortest in ${MON[avg[avg.length - 1][0] - 1]} (${n0(avg[avg.length - 1][1])} days).`
      : "";
    return { data: { series, xMax: 12, ticks: MON.map((m, i) => ({ x: i + 1, label: m })) }, years, note };
  }, [full, step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c || !W) return null;
  const big = W.steps.lead_to_done;
  const legs = [["Lead", null], ["Sit", W.steps.lead_to_sit], ["Sale", W.steps.sit_to_sale], ["Completed", W.steps.sale_to_done]] as [string, any][];
  const cur = chart?.years[chart.years.length - 1] ?? 0, prev = chart?.years[chart.years.length - 2] ?? 0;
  const toggle = (y: number) => setHidden((h) => { const n = new Set(h); n.has(y) ? n.delete(y) : n.add(y); return n; });

  return (
    <section id="cycle">
      <div className="sechead">
        <h2>Cycle time <small>How long each step takes. The typical job (median), timed on what finished in the window, by the company&apos;s rules.</small> <SecHelp k="cycle" /></h2>
        <Seg label="Cycle window" value={win} options={WIN} onChange={setWin} />
      </div>
      <div className="clock-big">
        <div>
          <span className="label">Lead to completed</span>
          <span className="huge num">{big?.median != null ? n0(big.median) : "–"}<small> days</small></span>
          <span className="sub">{big?.n ? <>Typical of {n0(big.n)} jobs completed {dfmt(W.start)} to {dfmt(W.end)}. Middle half: {n0(big.p25)} to {n0(big.p75)} days.</> : "No completed jobs in this window yet."}</span>
        </div>
        <ol className="legs" aria-label="The steps in order">
          {legs.map(([name, s], i) => (
            <li key={name}>
              {i ? <span className="gap num">{days(s?.median)}</span> : null}
              <span className="stop">{name}</span>
            </li>
          ))}
        </ol>
        <span className="sub">Each step is timed on its own records, so the steps do not add up exactly to the total.</span>
      </div>
      <div className="clocks">
        {SMALL_KEYS.map((k) => {
          const s = W.steps[k];
          return (
            <button key={k} type="button" className={`clock ${step === k ? "on" : ""}`} onClick={() => setStep(k)} aria-pressed={step === k}>
              <span className="label">{label(k)}</span>
              <span className="big num">{days(s?.median)}</span>
              <span className="sub">
                {!s?.n ? "Nothing finished this step yet." : k === "lead_to_appt"
                  ? <>{pct(s.same_day / s.n, 0)} booked the same day ({n0(s.same_day)} of {n0(s.n)})</>
                  : <>Middle half {n0(s.p25)} to {n0(s.p75)} days · {n0(s.n)} records</>}
              </span>
              <Spark pts={last13.map((m: any) => ((m.steps[k]?.n ?? 0) >= 5 ? m.steps[k].median : null))} />
            </button>
          );
        })}
      </div>
      {chart ? (
        <div className="cyc-chart">
          <div className="sechead">
            <span className="label">By month, one line per year</span>
            <label className="chan">Show
              <select value={step} onChange={(e) => setStep(e.target.value)}>
                {c.steps.map((s: any) => <option key={s.key} value={s.key}>{s.label} (days)</option>)}
                <option value="busy">How busy: jobs sold</option>
              </select>
            </label>
          </div>
          <LineChart data={chart.data} fmt={(v) => (step === "busy" ? n0(v) : `${n0(v)} d`)} curYear={cur} lastYear={prev} hidden={hidden} cutX={null} />
          <div className="legend" role="group" aria-label="Years shown">
            {chart.years.slice().reverse().map((y) => (
              <button key={y} type="button" className="yr" aria-pressed={!hidden.has(y)} onClick={() => toggle(y)}>
                <YearSwatch y={y} curYear={cur} lastYear={prev} years={chart.years} />{y}
              </button>
            ))}
          </div>
          {chart.note ? <p className="sub">{chart.note} Months with fewer than 5 records are left off. This month is left off until it ends.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
