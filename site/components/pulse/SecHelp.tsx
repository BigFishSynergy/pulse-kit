"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { teach } from "@/lib/pulse/teach";

// One "What can I do with this?" button per page, at the top (it used to sit on almost every
// section). It opens one card covering each section on the page: what it shows, why it matters, how to use it.
// In Simple view a section's heading keeps a small Options button that brings back that section's buttons
// (periods, metrics, channels). Nothing is ever removed.

/** The Options button in a section's heading. `k` names the section (kept so each section is labeled in the code). */
export default function SecHelp({ k: _k }: { k: string; role?: "lead" | "rep" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hasOpts, setHasOpts] = useState(false);
  const [opts, setOpts] = useState(false);
  useEffect(() => {
    const sec = ref.current?.closest("section");
    setHasOpts(!!sec?.querySelector(".seg, label.chan"));
  }, []);
  const toggle = () => {
    ref.current?.closest("section")?.classList.toggle("opts");
    setOpts((o) => !o);
  };
  return (
    <span ref={ref} className="sechelp">
      {hasOpts ? <button type="button" className="opts-btn" aria-pressed={opts} onClick={toggle}>{opts ? "Hide options" : "Options"}</button> : null}
    </span>
  );
}

/** The page's one help button. `keys` are the sections on the page, in order. */
export function PageHelp({ keys, role = "lead" }: { keys: string[]; role?: "lead" | "rep" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  const cards = keys.map((k) => teach(k, role)).filter(Boolean) as NonNullable<ReturnType<typeof teach>>[];
  if (!cards.length) return null;
  const root = typeof document !== "undefined" ? document.getElementById("rr") : null;
  return (
    <div className="pagehelp">
      <button type="button" className="teach-btn" onClick={() => setOpen(true)}><i aria-hidden>?</i>What can I do with this page?</button>
      {open && root ? createPortal(
        <div className="teach-wrap" onClick={() => setOpen(false)}>
          <div className="teach" role="dialog" aria-modal="true" aria-label="What can I do with this page?" onClick={(e) => e.stopPropagation()}>
            <div className="teach-head"><span className="label">What can I do with this page?</span><button type="button" className="link" onClick={() => setOpen(false)} aria-label="Close">Close</button></div>
            {cards.map((t, i) => (
              <details key={i} open={i === 0}>
                <summary>{t.title}</summary>
                <div className="teach-body">
                  <div><span className="label">What it shows</span><p>{t.what}</p></div>
                  <div><span className="label">Why it matters to you</span><p>{t.why}</p></div>
                  <div><span className="label">How to use it</span><ul>{t.how.map((h, j) => <li key={j}>{h}</li>)}</ul></div>
                </div>
              </details>
            ))}
          </div>
        </div>, root) : null}
    </div>
  );
}
