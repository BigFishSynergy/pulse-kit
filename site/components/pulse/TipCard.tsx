"use client";
import { useEffect, useState } from "react";

// One quiet card from the Pulse Kit's maker when a number has been behind for a while. Close it and it stays closed for
// that number until the week changes. Never shown to reps or CSRs.
export default function TipCard({ tip, week, call, site, name, title }: {
  tip: { key: string; label: string; area: string; line: string; weeks: number }; week: string; call: string; site: string; name: string; title: string;
}) {
  const id = `rr.tip.${week}.${tip.key}`;
  const [hide, setHide] = useState(true);
  useEffect(() => { try { setHide(localStorage.getItem(id) === "1"); } catch { setHide(false); } }, [id]);
  if (hide) return null;
  return (
    <aside className="tipcard">
      <div>
        <span className="label">Worth a look</span>
        <p><b>{tip.label} has been behind its goal {tip.weeks} of the last 4 weeks.</b> {tip.line} {tip.area[0].toUpperCase() + tip.area.slice(1)} is one of the areas <a href={site} target="_blank" rel="noopener noreferrer">{name}, {title}</a>, walks through with owners. <a href={call} target="_blank" rel="noopener noreferrer">A 15-minute Clarity Call</a>, no pitch.</p>
      </div>
      <button type="button" className="linkbtn" onClick={() => { try { localStorage.setItem(id, "1"); } catch {} setHide(true); }}>Not now</button>
    </aside>
  );
}
