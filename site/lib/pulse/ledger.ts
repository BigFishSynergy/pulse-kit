// Adds up the Report Builder ledger (site/pipeline/facts.py) for any date range, filter and grouping.
// The ledger stores, per record and per date, which of the rules' masks (rules/pulse_metrics.py) it passes, so these sums equal
// rr_metrics.metrics() for the same range. The data job proves that on every build before it publishes.

import { county, OUTSIDE, townCounty } from "./county";

export type Facts = {
  epoch: string;
  kinds: string[];
  dims: { rep: string[]; src: string[]; sub: string[]; zip: string[]; csr: string[] };
  roster: string[];
  towns: Record<string, string>;
  rows: number;
  cols: { k: number[]; d: number[]; r: number[]; s: number[]; u: number[]; z: number[]; c: number[]; f: number[]; v: number[]; p: number[] };
};

export type Totals = {
  contacts: number; leads: number; appointments: number; sits: number;
  // cs: close-rate demos held. cr: demos signed in the range (Close Rate, the scoreboard rule).
  // cw: demos held in the range that ever signed (Demo Conversion, for sources, towns and setters).
  cs: number; cr: number; cw: number;
  sales: number; jobs: number; revenue: number; installs: number; upgrades: number; upgradesN: number; gpP: number; gpC: number;
};
export const zero = (): Totals => ({ contacts: 0, leads: 0, appointments: 0, sits: 0, cs: 0, cr: 0, cw: 0, sales: 0, jobs: 0, revenue: 0, installs: 0, upgrades: 0, upgradesN: 0, gpP: 0, gpC: 0 });

export type GroupBy = "none" | "rep" | "src" | "sub" | "town" | "county" | "csr" | "week" | "month" | "quarter" | "year" | "dow";
// closeTeam: count close-rate sits only for reps on the sales roster (the rules' default for close rate).
export type Filters = { reps?: Set<string> | null; srcs?: Set<string> | null; teamOnly?: boolean; closeTeam?: boolean };

const DAY = 864e5;
export function dayIndex(f: Facts, iso: string) {
  return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(f.epoch + "T00:00:00Z")) / DAY);
}
export function isoOf(f: Facts, d: number) {
  return new Date(Date.parse(f.epoch + "T00:00:00Z") + d * DAY).toISOString().slice(0, 10);
}
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The label a record lands under for a grouping. Time groupings use each metric's own date, per the rules. */
function keyer(f: Facts, by: GroupBy): (i: number) => string {
  const c = f.cols, D = f.dims;
  switch (by) {
    case "rep": return (i) => D.rep[c.r[i]];
    case "src": return (i) => D.src[c.s[i]];
    case "sub": return (i) => D.sub[c.u[i]];
    case "csr": return (i) => D.csr[c.c[i]];
    case "town": return (i) => { const z = D.zip[c.z[i]]; return z ? townCounty(f.towns[z] ?? z, z) : "(no zip)"; };
    case "county": return (i) => { const z = D.zip[c.z[i]]; const k = county(z); return !z ? "(no zip)" : k === "OUT" ? OUTSIDE : k ?? "Outside the zip list"; };
    case "week": return (i) => { const d = c.d[i]; const dt = new Date(Date.parse(f.epoch + "T00:00:00Z") + d * DAY); const dow = (dt.getUTCDay() + 6) % 7; return isoOf(f, d - dow); };
    case "month": return (i) => isoOf(f, c.d[i]).slice(0, 7);
    case "quarter": return (i) => { const s = isoOf(f, c.d[i]); return `${s.slice(0, 4)} Q${Math.floor((+s.slice(5, 7) - 1) / 3) + 1}`; };
    case "year": return (i) => isoOf(f, c.d[i]).slice(0, 4);
    case "dow": return (i) => { const dt = new Date(Date.parse(f.epoch + "T00:00:00Z") + c.d[i] * DAY); return DOW[(dt.getUTCDay() + 6) % 7]; };
    default: return () => "All";
  }
}

/** Sum the ledger between two ISO dates (both included), grouped by up to two dimensions. */
export function aggregate(f: Facts, start: string, end: string, filters: Filters, by: GroupBy = "none", by2: GroupBy = "none") {
  const a = dayIndex(f, start), b = dayIndex(f, end);
  const c = f.cols, D = f.dims;
  const roster = new Set(f.roster);
  const k1 = keyer(f, by), k2 = keyer(f, by2);
  const out = new Map<string, Map<string, Totals>>();
  for (let i = 0; i < c.k.length; i++) {
    const d = c.d[i];
    if (d < a || d > b) continue;
    const rep = D.rep[c.r[i]];
    if (filters.teamOnly && !roster.has(rep)) continue;
    if (filters.reps && !filters.reps.has(rep)) continue;
    if (filters.srcs && !filters.srcs.has(D.src[c.s[i]])) continue;
    const g1 = k1(i), g2 = k2(i);
    let row = out.get(g1);
    if (!row) out.set(g1, (row = new Map()));
    let t = row.get(g2);
    if (!t) row.set(g2, (t = zero()));
    const fl = c.f[i], v = c.v[i];
    switch (f.kinds[c.k[i]]) {
      case "L": t.contacts += fl & 1; t.leads += (fl >> 1) & 1; break;
      case "A": t.appointments += 1; break;
      case "I": t.sits += fl & 1; if (fl & 2 && (!filters.closeTeam || roster.has(rep))) { t.cs += 1; t.cw += (fl >> 2) & 1; } break;
      case "S": if (fl & 1) t.sales += v; t.jobs += (fl >> 1) & 1; if (fl & 4 && (!filters.closeTeam || roster.has(rep))) t.cr += 1; break;
      case "C":
        if (fl & 1) t.revenue += v;
        t.installs += (fl >> 1) & 1;
        if (fl & 4) { t.upgrades += v; t.upgradesN += 1; }
        if (fl & 8) { t.gpP += c.p[i]; t.gpC += v; } // data built before Oct 18 2026 kept GP on the install row
        break;
      // GP % by the day the job went Closed (the one GP rule: upgrades in, Call Backs out)
      case "G": if (fl & 1) { t.gpP += c.p[i]; t.gpC += v; } break;
    }
  }
  return out;
}

export function add(a: Totals, b: Totals) {
  const o = zero();
  (Object.keys(o) as (keyof Totals)[]).forEach((k) => (o[k] = a[k] + b[k]));
  return o;
}

export type MetricKey = "leads" | "contacts" | "appointments" | "sits" | "sold" | "close" | "demo_conv" | "booking" | "sit_rate" | "sales" | "jobs" | "ticket" | "spl" | "revenue" | "installs" | "upgrades" | "ug_pct" | "gp";
export type MetricDef = { key: MetricKey; label: string; kind: "count" | "money" | "rate"; value: (t: Totals) => number | null; n?: (t: Totals) => number; d?: (t: Totals) => number };

export const METRICS: MetricDef[] = [
  { key: "leads", label: "Leads", kind: "count", value: (t) => t.leads },
  { key: "contacts", label: "Contacts", kind: "count", value: (t) => t.contacts },
  { key: "appointments", label: "Appointments", kind: "count", value: (t) => t.appointments },
  { key: "sits", label: "Sits", kind: "count", value: (t) => t.sits },
  { key: "sold", label: "Demos signed (close rate)", kind: "count", value: (t) => t.cr },
  { key: "close", label: "Close rate", kind: "rate", value: (t) => (t.cs ? t.cr / t.cs : null), n: (t) => t.cr, d: (t) => t.cs },
  { key: "demo_conv", label: "Demo conversion", kind: "rate", value: (t) => (t.cs ? t.cw / t.cs : null), n: (t) => t.cw, d: (t) => t.cs },
  { key: "booking", label: "Booking rate", kind: "rate", value: (t) => (t.leads ? t.appointments / t.leads : null), n: (t) => t.appointments, d: (t) => t.leads },
  { key: "sit_rate", label: "Sit rate", kind: "rate", value: (t) => (t.appointments ? t.sits / t.appointments : null), n: (t) => t.sits, d: (t) => t.appointments },
  { key: "sales", label: "Sales", kind: "money", value: (t) => t.sales },
  { key: "jobs", label: "Jobs sold", kind: "count", value: (t) => t.jobs },
  { key: "ticket", label: "Avg ticket", kind: "money", value: (t) => (t.jobs ? t.sales / t.jobs : null) },
  { key: "spl", label: "Sales per lead", kind: "money", value: (t) => (t.leads ? t.sales / t.leads : null) },
  { key: "revenue", label: "Revenue", kind: "money", value: (t) => t.revenue },
  { key: "installs", label: "Jobs installed", kind: "count", value: (t) => t.installs },
  { key: "upgrades", label: "Upgrades", kind: "money", value: (t) => t.upgrades },
  { key: "ug_pct", label: "UG % of revenue", kind: "rate", value: (t) => (t.revenue ? t.upgrades / t.revenue : null), n: (t) => t.upgrades, d: (t) => t.revenue },
  { key: "gp", label: "GP %", kind: "rate", value: (t) => (t.gpC ? t.gpP / t.gpC : null) },
];
export const metric = (k: string) => METRICS.find((m) => m.key === k) ?? METRICS[0];
