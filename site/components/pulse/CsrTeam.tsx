"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Win } from "./ui";
import { moneyK, n0, pct } from "@/lib/pulse/format";

// Leadership: the CSRs, with their CSR card POWER and last 90 days (site/pipeline/deals.py, csr_cards). Tap a name
// for that CSR's screen, exactly as they see it.

export default function CsrTeam({ cc }: { cc: any }) {
  const cards: any[] = cc?.cards ?? [], coming: any[] = cc?.coming ?? [];
  if (!cards.length && !coming.length) return null;
  return (
    <section className="cl-panel" id="csrs">
      <div className="cl-panel-h"><span className="cl-k">The CSRs</span><Win>last {cc.window.days} days</Win><span className="sub">POWER is their CSR card, rated like the sales cards. Tap a name for that CSR&apos;s screen.</span></div>
      <div className="cl-team">
        {cards.map((c) => (
          <Link key={c.csr} href={`/pulse/hq/csr/${c.slug}`} className="cl-rep">
            <span className={`cl-pow${c.power > 50 ? " good" : ""}${c.rank === 1 ? " first" : ""}`}><b className="num">{c.power}</b><small>Power</small></span>
            <span className="cl-name">{c.csr}</span>
            <span className="cl-stat"><b className="num">{n0(c.stats.set)}</b><small>set</small></span>
            <span className="cl-stat opt"><b className="num">{c.stats.set ? pct(c.stats.sat / c.stats.set, 0) : "–"}</b><small>sat</small></span>
            <span className="cl-stat"><b className="num">{c.stats.demos ? pct(c.stats.signed / c.stats.demos, 0) : "–"}</b><small>signed</small></span>
            <span className="cl-stat opt"><b className="num">{moneyK(c.stats.sales)}</b><small>sales</small></span>
          </Link>
        ))}
        {coming.map((c) => (
          <Link key={c.csr} href={`/pulse/hq/csr/${c.csr.toLowerCase()}`} className="cl-rep">
            <span className="cl-pow"><b>New</b><small>{c.demos}/{c.needed}</small></span>
            <span className="cl-name">{c.csr}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
