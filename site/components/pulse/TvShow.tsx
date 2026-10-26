"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { CO, CONFIG } from "@/lib/pulse/config";
import { moneyK, n0, pct } from "@/lib/pulse/format";

// The office TV: one big slide at a time, a thin bar showing how long until the next, the data time in the corner.
// It reloads itself every 10 minutes for fresh numbers. Built for reading across a room: few numbers, very large.
const val = (t: any) => (t.value == null ? "–" : t.money ? moneyK(t.value) : t.pct ? pct(t.value) : n0(t.value));
const tone = (t: any) => (t.status === "good" ? "good" : t.status === "bad" ? "bad" : t.status === "near" ? "near" : t.goal ? (t.value >= t.goal ? "good" : t.value >= t.goal * 0.9 ? "near" : "bad") : "");

function Slide({ s }: { s: any }) {
  if (s.tiles) return <div className="tv-tiles">{s.tiles.map((t: any) => (
    <div key={t.label} className={`tv-tile ${tone(t)}`}><span className="tv-l">{t.label}</span><span className="tv-v">{val(t)}</span>{t.goal ? <span className="tv-g">goal {t.money ? moneyK(t.goal) : n0(t.goal)}</span> : null}</div>))}</div>;
  if (s.boxes) return <div className="tv-boxes">{s.boxes.map((b: any) => (
    <div key={b.label} className={`tv-box ${tone(b)}`}><span className="tv-l">{b.label}</span><span className="tv-v sm">{b.value == null ? "–" : b.fmt === "money" ? moneyK(b.value) : b.fmt === "rate" || b.fmt === "pct" ? pct(b.value?.pct ?? b.value) : n0(b.value)}</span><span className="tv-g">{b.owner}</span></div>))}</div>;
  if (s.bars) return <div className="tv-bars">{s.bars.map((b: any) => {
    const max = Math.max(b.value, b.goal ?? 0, 1);
    return <div key={b.label} className="tv-bar"><span className="tv-l">{b.label}</span>
      <div className="tv-track"><i style={{ width: `${(b.value / max) * 100}%` }} />{b.pace ? <b style={{ left: `${(b.pace / max) * 100}%` }} title="pace" /> : null}</div>
      <span className="tv-g"><span className="tv-v sm">{moneyK(b.value)}</span>{b.goal ? ` of ${moneyK(b.goal)}${b.pace ? `, pace ${moneyK(b.pace)}` : ""}` : ""}</span></div>; })}</div>;
  if (s.rows) return <ol className="tv-rows">{s.rows.map((r: any, i: number) => (
    <li key={r.name} className={i === 0 ? "first" : ""}><span className="tv-rank">{i + 1}</span><span className="tv-name">{r.name}</span>
      <span className="tv-num">{r.power != null ? <>{r.power} <small>POWER</small></> : r.sold != null ? <>{r.label} <small>{r.sold} of 10</small></> : r.leads != null ? <>{n0(r.leads)} <small>leads</small></> : <>{moneyK(r.sales)} <small>{r.jobs ? `${r.jobs} jobs` : ""}</small></>}</span>
      {r.power != null && r.sales ? <span className="tv-side">{moneyK(r.sales)} this month</span> : r.leads != null && r.sales ? <span className="tv-side">{moneyK(r.sales)} sold</span> : null}</li>))}</ol>;
  return null;
}

export default function TvShow({ name, seconds, dark, meta, slides }: { name: string; seconds: number; dark: boolean; meta: any; slides: any[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % Math.max(slides.length, 1)), seconds * 1000);
    const r = setTimeout(() => location.reload(), 10 * 60 * 1000);
    return () => { clearInterval(t); clearTimeout(r); };
  }, [seconds, slides.length]);
  const s = slides[i];
  return (
    <div className={`tv ${dark ? "dark" : ""}`}>
      <header className="tv-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CONFIG.brand.logo_on_dark} alt={CO.name} />
        <h1>{s?.title ?? name}</h1>
        <span className="tv-when">{s?.sub ? `${s.sub} · ` : ""}{meta ? `Data ${meta.pulled_at}` : "Waiting for data"}</span>
      </header>
      <main className="tv-main">{s ? <Slide s={s} /> : <p className="tv-g">No numbers yet. They show up after the first data pull.</p>}</main>
      <div className="tv-foot">
        <div className="tv-dots">{slides.map((x, k) => <i key={x.key} className={k === i ? "on" : ""} />)}</div>
        <div className="tv-timer" key={i} style={{ animationDuration: `${seconds}s` }} />
      </div>
    </div>
  );
}
