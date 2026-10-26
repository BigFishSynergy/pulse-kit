import "server-only";
import { county, OUTSIDE, REGIONS } from "./county";

// What Claude gets to see, by role. Leadership: the snapshot (history folded to months) and the top zips.
// A rep: only their own file and the leaderboard tops already inside it.

/* eslint-disable @typescript-eslint/no-explicit-any */
function dayDate(y: number, i: number) {
  return new Date(Date.UTC(y, 0, 1 + i));
}

/** The snapshot without the daily history, plus monthly totals per year, plus every zip in the service area. */
export function leadContext(s: any, geo: any, coaching: any) {
  const copy = { ...s };
  delete copy.history;
  if (s.history) {
    const out: any = {};
    Object.entries(s.history.metrics).forEach(([k, per]: [string, any]) => {
      out[k] = {};
      Object.entries(per).forEach(([y, arr]: [string, any]) => {
        const mon = Array(12).fill(0);
        arr.forEach((v: number, i: number) => (mon[dayDate(+y, i).getUTCMonth()] += v));
        out[k][y] = { total: Math.round(arr.reduce((a: number, b: number) => a + b, 0)), by_month: mon.map((v) => Math.round(v)) };
      });
    });
    copy.history_by_month = { as_of: s.history.as_of, note: "Current year is only through as_of.", metrics: out };
  }
  if (geo?.windows?.["365"]) {
    copy.zips_last_12_months = allZips(geo);
    copy.towns_best_and_worst_by_county = bestWorst(copy.zips_last_12_months);
  }
  if (geo?.windows) copy.by_county = byCounty(geo);
  if (coaching) copy.this_week_notes = { priorities: coaching.priorities, worth_knowing: coaching.worth_knowing };
  return copy;
}

/** Every service-area zip with any activity in the last 12 months, with town and region. Zips outside the area stay out. */
function allZips(geo: any) {
  return Object.entries(geo.windows["365"].zips)
    .map(([z, v]: [string, any]) => ({ zip: z, town: geo.places?.[z]?.[2], county: county(z), ...v, sales: Math.round(v.sales || 0), sales_jobs: undefined,
      close_rate: v.sits ? Math.round((v.sold / v.sits) * 1000) / 10 : null }))
    .filter((r: any) => REGIONS.includes(r.county))
    .sort((a: any, b: any) => b.sales - a.sales);
}

/** Best and worst five towns in each county, by sales (towns with 10+ leads) and by close rate (10+ sits), so the bottom is real. */
function bestWorst(rows: any[]) {
  const out: any = { note: "Last 12 months. Worst by sales only counts zips with 10 or more leads; close rate only zips with 10 or more sits." };
  REGIONS.forEach((c) => {
    const mine = rows.filter((r) => r.county === c);
    const bySales = mine.filter((r) => r.leads >= 10).sort((a, b) => b.sales - a.sales);
    const byClose = mine.filter((r) => r.sits >= 10).sort((a, b) => b.close_rate - a.close_rate);
    const pick = (r: any) => ({ zip: r.zip, town: r.town, sales: r.sales, leads: r.leads, sits: r.sits, sold: r.sold, close_rate: r.close_rate });
    out[c] = { zips_with_activity: mine.length, best_5_by_sales: bySales.slice(0, 5).map(pick), worst_5_by_sales: bySales.slice(-5).reverse().map(pick),
      best_5_by_close_rate: byClose.slice(0, 5).map(pick), worst_5_by_close_rate: byClose.slice(-5).reverse().map(pick) };
  });
  return out;
}

/** Each region and the out-of-area block added up for every map window, so region questions have real totals. */
function byCounty(geo: any) {
  const out: any = {};
  Object.entries(geo.windows ?? {}).forEach(([w, win]: [string, any]) => {
    const t: any = {};
    Object.entries(win.zips ?? {}).forEach(([z, v]: [string, any]) => {
      const c = county(z);
      if (!c) return;
      const k = c === "OUT" ? OUTSIDE : c;
      t[k] = t[k] || {};
      Object.entries(v).forEach(([m, n]) => { if (typeof n === "number") t[k][m] = Math.round(((t[k][m] || 0) + n) * 100) / 100; });
    });
    out[w === "all" ? "all_time" : `last_${w}_days`] = { start: win.start, end: win.end, ...t };
  });
  return out;
}

export function repContext(r: any, card: any) {
  const { geo, ...rest } = r;
  const zips = Object.entries(geo?.windows?.["365"]?.zips ?? {}).map(([z, v]: [string, any]) => ({ zip: z, town: geo.places?.[z]?.[2], county: county(z), ...v }));
  return { ...rest, my_zips_last_12_months: zips, my_counties: geo?.windows ? byCounty(geo) : undefined, my_coaching_card: card };
}

