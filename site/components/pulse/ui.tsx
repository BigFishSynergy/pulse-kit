"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { n0, pct, type GoalState, type Rate } from "@/lib/pulse/format";

/** A row of buttons where exactly one is on. */
export function Seg<T extends string>({ value, options, onChange, label, disabled }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string; disabled?: boolean;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, lb]) => (
        <button key={k} type="button" aria-pressed={k === value && !disabled} disabled={disabled} onClick={() => onChange(k)}>
          {lb}
        </button>
      ))}
    </div>
  );
}

/** "35.3% (12 of 34)" */
export function RateTxt({ r }: { r: Rate }) {
  if (!r || r.pct == null) return <>–</>;
  return (
    <>
      {pct(r.pct)} <span className="sub">({n0(r.n)} of {n0(r.d)})</span>
    </>
  );
}

/** UI choices (which tab is open) remembered per browser. Never data. */
export function usePersist(key: string, initial: string, allowed: readonly string[]): [string, (v: string) => void] {
  const [v, setV] = useState<string>(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem("rr." + key);
      if (s && allowed.includes(s)) setV(s);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (x: string) => {
    setV(x);
    try {
      localStorage.setItem("rr." + key, x);
    } catch {}
  };
  return [v, set];
}

/** Up or down against last year. Plain gray: color only ever comes from a goal. Rates compare in points. */
export function ChangeChip({ a, b, points }: { a: number | null | undefined; b: number | null | undefined; points?: boolean }) {
  if (a == null || b == null) return <span className="sub">–</span>;
  if (points) {
    const p = (a - b) * 100;
    if (!isFinite(p)) return <span className="sub">–</span>;
    return <span className="chg">{(p >= 0 ? "+" : "−") + (Math.abs(p) < 1 ? Math.abs(p).toFixed(1) : Math.round(Math.abs(p)))} pts</span>;
  }
  if (!b) return a ? <span className="chg">New</span> : <span className="sub">–</span>;
  const c = (a - b) / b;
  return <span className="chg">{(c >= 0 ? "+" : "−") + pct(Math.abs(c), 0)}</span>;
}

/** Where a number stands against its goal. Only shown when there is a goal. */
export function GoalChip({ state, children }: { state: GoalState | ""; children: React.ReactNode }) {
  if (!state) return null;
  return <span className={`chip ${state}`}>{children}</span>;
}

/** A box's own time window, when it is not the period picked at the top ("last 30 days"). */
export function Win({ children }: { children: React.ReactNode }) {
  return <span className="win">{children}</span>;
}

export function ThemeToggle() {
  const [t, setT] = useState<string>("");
  useEffect(() => {
    setT(document.getElementById("rr")?.dataset.theme || "");
  }, []);
  // The light look is the default for everyone; dark mode is a choice, remembered on this device.
  const flip = () => {
    const el = document.getElementById("rr");
    if (!el) return;
    const next = t === "dark" ? "light" : "dark";
    el.dataset.theme = next;
    setT(next);
    try {
      localStorage.setItem("rr.look", next);
    } catch {}
  };
  return (
    <button type="button" className="mi" onClick={flip}>
      {t === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

/** Option buttons on every section (Week, Month, Quarter...). Folded away by default; each section's Options button
 *  brings back just that section's. Clean or Everything is a different thing: it picks which sections show. Nothing is removed. */
export function SimpleToggle() {
  const [s, setS] = useState<string>("1");
  useEffect(() => {
    setS(document.getElementById("rr")?.dataset.simple ?? "1");
  }, []);
  const flip = () => {
    const el = document.getElementById("rr");
    if (!el) return;
    const next = s === "1" ? "0" : "1";
    el.dataset.simple = next;
    setS(next);
    try {
      localStorage.setItem("rr.simple", next);
    } catch {}
  };
  return (
    <button type="button" className="mi" onClick={flip} aria-pressed={s === "0"}>
      {s === "1" ? "Show every section's options" : "Fold section options away"}
      <small>{s === "1" ? "The Week, Month and other buttons inside each section" : "Each section keeps an Options button"}</small>
    </button>
  );
}

/** Look back at the numbers saved at the end of an earlier week. The first choice is always the latest numbers. */
export function WeekSelect({ weeks, current, base, latest }: { weeks: { week_start: string; label: string }[]; current: string; base: string; latest: string }) {
  const router = useRouter();
  if (weeks.length < 2) return null;
  return (
    <label className="lookback">
      <span>Look back at an earlier week</span>
      <select
        value={current}
        onChange={(e) => {
          const w = e.target.value;
          router.push(w === weeks[0].week_start ? base : `${base}?week=${w}`);
        }}
      >
        {weeks.map((w, i) => (
          <option key={w.week_start} value={w.week_start}>
            {i === 0 ? latest : w.label}
          </option>
        ))}
      </select>
    </label>
  );
}
