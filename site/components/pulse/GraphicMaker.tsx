"use client";
import { useRef, useState } from "react";
import { Seg } from "./ui";
import { CO } from "@/lib/pulse/config";

// "Make a graphic": describe it in plain words, Claude designs it on brand from the live numbers,
// then download a PNG or ask for changes. (No Slack posting from here: channels only get what the admin posts.)

export type ReportForGraphic = { title: string; sub: string; columns: string[]; rows: string[][] } | null;

const LEAD_CHIPS = [
  "Top 3 closers this quarter, for the break room TV",
  "Our quarter so far against the Q4 goal, big and bold",
  "Jobs installed this month, for Instagram",
  "This week's wins, one line per person",
];
const REP_CHIPS = ["My month so far, to share with my family", "Where I close best", "My best week this year"];
const REPORT_CHIP = "Turn the report on screen into an infographic";

export default function GraphicMaker({ scope, rep, report }: { scope: "lead" | "rep"; rep?: string; report?: ReportForGraphic }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("internal");
  const [format, setFormat] = useState("square");
  const [useReport, setUseReport] = useState(!!report);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ svg: string; base: string; w: number; h: number } | null>(null);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);


  async function make(change?: string) {
    const ask = (change ?? prompt).trim();
    if (!ask || busy) return;
    setBusy(true); setErr(""); setNote(""); setSecs(0);
    timer.current = setInterval(() => setSecs((x) => x + 1), 1000);
    try {
      const res = await fetch("/pulse/api/graphic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: ask, audience, format, rep, report: useReport ? report : null, previous: change ? result?.base : null }),
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "Claude could not make that one.");
      else { setResult(j); if (j.truncated) setNote("The design ran long and may be cut off. Ask for a simpler version."); }
    } catch {
      setErr("Claude could not make that one. Try again in a moment.");
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  }

  function toPng(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!result) return reject();
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = result.w; c.height = result.h;
        const x = c.getContext("2d")!;
        x.fillStyle = "#0A0A0A"; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(result.svg);
    });
  }
  async function download() {
    const a = document.createElement("a");
    a.href = await toPng();
    a.download = `pulse-graphic-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }

  const chips = [...(report ? [REPORT_CHIP] : []), ...(scope === "lead" ? LEAD_CHIPS : REP_CHIPS)];
  if (!open) {
    // a square sample post, so it reads as "make something you can post", plus ready-made ideas that open it filled in
    return (
      <section className="gfx-cta" aria-label="Make a graphic">
        <button type="button" className="gfx-post" onClick={() => setOpen(true)} aria-label="Make your own graphic">
          <span className="gp-top">{CO.name}</span>
          <span className="gp-head">Make your own graphic here</span>
          <span className="gp-line" />
          <span className="gp-sub">From the live numbers, in {CO.short_name}&apos;s brand</span>
          <span className="gp-foot">Square post · Story · TV</span>
        </button>
        <div className="gfx-copy">
          <h2>Make a graphic <small>Pick an idea or describe your own. Download it{scope === "lead" ? " or post it" : ""}.</small></h2>
          <div className="chips">{chips.slice(0, 3).map((c) => <button key={c} type="button" onClick={() => { setPrompt(c); setOpen(true); }}>{c}</button>)}</div>
          <button type="button" className="btn primary" onClick={() => setOpen(true)}>Make a graphic</button>
        </div>
      </section>
    );
  }
  return (
    <section className="gfx" aria-label="Make a graphic">
      <div className="sechead">
        <h2>Make a graphic <small>Claude designs it from the live numbers, in {CO.short_name}&apos;s brand, using the company&apos;s counting rules</small></h2>
        <button type="button" className="link" onClick={() => setOpen(false)}>Close</button>
      </div>
      <div className="chips">{chips.map((c) => <button key={c} type="button" onClick={() => setPrompt(c)} disabled={busy}>{c}</button>)}</div>
      <textarea rows={2} maxLength={800} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Example: a leaderboard of jobs sold this month with the top rep big in neon green, for Slack" aria-label="Describe the graphic" />
      <div className="seg-row">
        <Seg label="Audience" value={audience} options={[["internal", "Internal"], ["social", "Social media"]]} onChange={setAudience} />
        <Seg label="Size" value={format} options={[["square", "Square post"], ["story", "Story / phone"], ["wide", "Wide / TV"]]} onChange={setFormat} />
        {report ? <label className={`check ${useReport ? "on" : ""}`}><input type="checkbox" checked={useReport} onChange={() => setUseReport(!useReport)} />Use the report on screen</label> : null}
        <button type="button" className="btn primary" onClick={() => make()} disabled={busy || !prompt.trim()}>{busy ? `Designing ${secs}s` : "Create"}</button>
      </div>
      {audience === "social" ? <p className="sub">Social media versions leave out dollar amounts, profit, close rates and individual rep stats. Check with leadership before posting company numbers publicly.</p> : null}
      {err ? <p className="err">{err}</p> : null}
      {result ? (
        <div className="gfx-out">
          {/* An <img> never runs anything inside the SVG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Generated graphic" src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(result.svg)} style={{ aspectRatio: `${result.w} / ${result.h}` }} />
          <div className="gfx-side">
            <div className="btns">
              <button type="button" className="btn primary" onClick={download}>Download PNG</button>
            </div>
            <ChangeBox busy={busy} onChange={(t) => make(t)} />
            {note ? <p className="sub">{note}</p> : null}
            <p className="sub">Every number on it comes from this page&apos;s data. Give it a once-over before you post.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ChangeBox({ busy, onChange }: { busy: boolean; onChange: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onChange(t); setT(""); } }} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label className="label" htmlFor="gfx-change">Change something</label>
      <input id="gfx-change" type="text" value={t} onChange={(e) => setT(e.target.value)} placeholder="Example: make the title bigger, drop the bottom chart" />
      <button type="submit" className="btn" disabled={busy || !t.trim()}>Apply change</button>
    </form>
  );
}
