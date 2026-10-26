"use client";
import SecHelp from "./SecHelp";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Seg, usePersist } from "./ui";
import { county, OUTSIDE, REGIONS, REGION_WORD } from "@/lib/pulse/county";
import { dfmt, money, moneyK, n0, pct } from "@/lib/pulse/format";

// The service area's regions side by side (content/zips.json), from the same zip numbers as the map (close rate here is
// company-wide, like the map). The best region on each row is marked. Zips outside the area sit underneath as one line.

type T = { leads: number; appointments: number; sits: number; sold: number; jobs_sold: number; sales: number; sales_jobs: number; open: number; openN: number; homes: number };
const zero = (): T => ({ leads: 0, appointments: 0, sits: 0, sold: 0, jobs_sold: 0, sales: 0, sales_jobs: 0, open: 0, openN: 0, homes: 0 });
const WIN: [string, string][] = [["30", "30 days"], ["90", "90 days"], ["365", "12 months"], ["all", "All time"]];
const ROOF_LIFE = 20;

export default function CountyCompare({ geo }: { geo: any }) {
  const [win, setWin] = usePersist("countyWin", "365", WIN.map((w) => w[0]));
  const W = geo?.windows?.[win];
  const t = useMemo(() => {
    const out: Record<string, T> = Object.fromEntries([...REGIONS, "OUT"].map((r) => [r, zero()]));
    if (!W) return out;
    Object.entries(W.zips ?? {}).forEach(([z, v]: [string, any]) => {
      const c = county(z); if (!c) return;
      const o = out[c]; if (!o) return;
      (["leads", "appointments", "sits", "sold", "jobs_sold", "sales", "sales_jobs"] as const).forEach((k) => (o[k] += v[k] ?? 0));
    });
    Object.entries(geo.open ?? {}).forEach(([z, v]: [string, any]) => { const c = county(z); if (c && out[c]) { out[c].open += v.value; out[c].openN += v.count; } });
    Object.entries(geo.market ?? {}).forEach(([z, v]: [string, any]) => { const c = county(z); if (c && c !== "OUT" && out[c]) out[c].homes += v.homes_owned ?? 0; });
    return out;
  }, [W, geo]);
  if (!W) return null;

  const ticket = (x: T) => (x.jobs_sold ? x.sales_jobs / x.jobs_sold : null);
  const sum = (k: keyof T) => REGIONS.reduce((a, r) => a + t[r][k], 0);
  const allTicket = sum("jobs_sold") ? sum("sales_jobs") / sum("jobs_sold") : 15000;
  const both = sum("sales");
  type Row = { label: string; v: (x: T) => number | null; f: (v: number | null, x: T) => React.ReactNode; better?: "high" | "low"; note?: string };
  const rows: Row[] = [
    { label: "Leads", v: (x) => x.leads, f: (v) => n0(v), better: "high" },
    { label: "Appointments", v: (x) => x.appointments, f: (v, x) => <>{n0(v)} <span className="sub">{x.leads ? pct(x.appointments / x.leads, 0) + " booked" : ""}</span></>, better: "high" },
    { label: "Sits", v: (x) => x.sits, f: (v) => n0(v), better: "high" },
    { label: "Close rate", v: (x) => (x.sits ? x.sold / x.sits : null), f: (v, x) => <>{pct(v)} <span className="sub">({n0(x.sold)} of {n0(x.sits)})</span></>, better: "high" },
    { label: "Jobs sold", v: (x) => x.jobs_sold, f: (v) => n0(v), better: "high" },
    { label: "Sales", v: (x) => x.sales, f: (v) => money(v), better: "high" },
    { label: "Avg ticket", v: ticket, f: (v) => money(v), better: "high" },
    { label: "Sales per lead", v: (x) => (x.leads ? x.sales / x.leads : null), f: (v) => money(v), better: "high" },
    { label: "Open quotes", v: (x) => x.open, f: (v, x) => <>{money(v)} <span className="sub">({n0(x.openN)})</span></>, note: `Quoted, not sold yet, last ${geo.open_days} days, any window` },
    { label: "Owned homes", v: (x) => x.homes, f: (v) => n0(v), note: "Census 2020-2024" },
    { label: "Leads per 1,000 homes", v: (x) => (x.homes ? (1000 * x.leads) / x.homes : null), f: (v) => (v == null ? "–" : v.toFixed(1)), better: "high", note: "Reach in this window" },
    { label: "Roof market, estimate", v: (x) => (x.homes ? (x.homes / ROOF_LIFE) * allTicket : null), f: (v) => (v == null ? "–" : `${moneyK(v)} a year`), note: "Owned homes / 20-year roof life x avg ticket" },
  ];
  const win2 = (r: Row) => {
    if (!r.better) return null;
    const vals = REGIONS.map((c) => [c, r.v(t[c])] as const).filter(([, v]) => v != null) as [string, number][];
    if (vals.length < 2) return null;
    vals.sort((a, b) => (r.better === "high" ? b[1] - a[1] : a[1] - b[1]));
    return vals[0][1] === vals[1][1] ? null : vals[0][0];
  };

  return (
    <section id="counties">
      <div className="sechead">
        <h2>{REGIONS.join(" vs ")} <small>{dfmt(W.start)} {W.start.slice(0, 4)} to {dfmt(W.end)} {W.end.slice(0, 4)}. The best {REGION_WORD.toLowerCase()} on each line is marked green.</small> <SecHelp k="counties" /></h2>
        <Seg label={`${REGION_WORD} window`} value={win} options={WIN} onChange={setWin} />
      </div>
      <div className="county-head" style={{ gridTemplateColumns: `repeat(${Math.max(REGIONS.length, 1)}, 1fr)` }}>
        {REGIONS.map((c) => (
          <div key={c}><span className="label">{c}</span><span className="big num">{moneyK(t[c].sales)}</span><span className="sub">{both ? pct(t[c].sales / both, 0) : "–"} of sales · {n0(t[c].jobs_sold)} jobs sold</span></div>
        ))}
        <div className="split" role="img" aria-label={REGIONS.map((c) => `${c} ${both ? pct(t[c].sales / both, 0) : "–"} of sales`).join(", ")} style={{ display: "flex" }}>
          {REGIONS.map((c, i) => { const w = both ? t[c].sales / both : 1 / REGIONS.length; return <i key={c} style={{ width: `${(w * 100).toFixed(1)}%`, opacity: 1 - (i % 2) * 0.45 }} />; })}
        </div>
      </div>
      <div className="tbl">
        <table className="tight county-t">
          <thead><tr><th />{REGIONS.map((c) => <th key={c} className="r">{c}</th>)}<th>What it means</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const w = win2(r);
              return (
                <tr key={r.label}>
                  <td className="m">{r.label}</td>
                  {REGIONS.map((c) => <td key={c} className={`r num ${w === c ? "best" : ""}`}>{r.f(r.v(t[c]), t[c])}</td>)}
                  <td className="sub">{r.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="explain">{OUTSIDE}: {n0(t.OUT.leads)} leads, {n0(t.OUT.sold)} of {n0(t.OUT.sits)} sits sold, {money(t.OUT.sales)} in sales in this window. Close rate here is company-wide, like the map. {REGION_WORD} comes from each record&apos;s zip code.</p>
    </section>
  );
}
