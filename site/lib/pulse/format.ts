import { TZ } from "./config";
// Number and date formatting shared by every Pulse screen. Same rules as the prototype:
// whole dollars, rates with their counts, dates as "Oct 7".
// Sentences (Priorities, Worth knowing, coaching cards) round further, see `tidy`.

export type Rate = { n: number; d: number; pct: number | null } | null | undefined;

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const money = (v: number | null | undefined) => (v == null ? "–" : "$" + Math.round(v).toLocaleString("en-US"));
export const moneyK = (v: number | null | undefined) =>
  v == null ? "–" : Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000) + "K";
export const n0 = (v: number | null | undefined) => (v == null ? "–" : Math.round(v).toLocaleString("en-US"));
/** An average of a count: whole from 10 up, one decimal below (2.6 jobs, 23 sits). */
export const n1 = (v: number | null | undefined) =>
  v == null ? "–" : Number.isInteger(v) || Math.abs(v) >= 10 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1);
export const pct = (v: number | null | undefined, d = 1) => (v == null ? "–" : (v * 100).toFixed(d) + "%");

const one = (x: number) => {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};
/** Dollars in a sentence: $4.5M, $368K, $12.7K, $9,512. One decimal at most, never cents. */
export function moneyS(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "–";
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 999_500) return `${s}$${one(a / 1e6)}M`;
  if (a >= 99_950) return `${s}$${Math.round(a / 1000)}K`;
  if (a >= 10_000) return `${s}$${one(a / 1000)}K`;
  return `${s}$${Math.round(a).toLocaleString("en-US")}`;
}

const LEAD_EMOJI = /^\s*(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️)+\s*/u;

/** Generated sentences, rounded the way people read them. Dollars from $10K go to $K or $M with
 *  one decimal at most, smaller dollars are whole, counts and paces are whole, percentages are whole unless two in the
 *  same sentence would round to the same number (then one decimal), and points under 1 keep one decimal.
 *  `noEmoji` takes a leading emoji off (leadership screens keep lists in one plain style). */
export function tidy(text: string | null | undefined, opts?: { noEmoji?: boolean }): string {
  if (!text) return "";
  let t = String(text);
  if (opts?.noEmoji) t = t.replace(LEAD_EMOJI, "");
  return t.split(/(?<=[.!?])\s+/).map(sentence).join(" ");
}

function sentence(s: string): string {
  const keep: string[] = [];
  const hold = (x: string) => `\u0000${keep.push(x) - 1}\u0000`;
  // Dollars, with or without a K or M already on them.
  s = s.replace(/(-?)\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?:\s?([KkMm])(?![a-z]))?/g, (_m, neg: string, whole: string, dec: string | undefined, unit: string | undefined) => {
    let v = Number(whole.replace(/,/g, "") + (dec ?? ""));
    if (unit) v *= /m/i.test(unit) ? 1e6 : 1e3;
    return hold(moneyS(neg ? -v : v));
  });
  // Percentages: whole, unless two different ones would round to the same whole number.
  const pcts = [...s.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((m) => Number(m[1]));
  const clash = pcts.some((a, i) => pcts.some((b, j) => i !== j && a !== b && Math.round(a) === Math.round(b)));
  s = s.replace(/(\d+(?:\.\d+)?)(\s?)%/g, (_m, v: string, sp: string) => hold(`${clash ? one(Number(v)) : Math.round(Number(v))}${sp}%`));
  // Points: one decimal under 1, whole from 1 up.
  s = s.replace(/([+\-−]?)(\d+\.\d+)(\s?)(pts?\b|points?\b|percentage points?\b)/g, (_m, sign: string, v: string, sp: string, w: string) => {
    const n = Number(v);
    return hold(`${sign}${n < 1 ? one(n) : Math.round(n)}${sp}${w}`);
  });
  // Any other decimal: whole from 10 up (counts, paces), one decimal below (1.2 days).
  s = s.replace(/(?<![\d.,:])(\d{1,3}(?:,\d{3})+|\d+)\.(\d+)(?![\d.]|\s?%)/g, (_m, whole: string, dec: string) => {
    const n = Number(whole.replace(/,/g, "") + "." + dec);
    return n >= 10 ? Math.round(n).toLocaleString("en-US") : one(n);
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => keep[+i]);
}

/** "Written Mon Oct 12, 6:31 AM" in Eastern time, for text Claude wrote ahead of time. */
export function written(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).replace(",", "");
  const time = d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return `Written ${day}, ${time}`;
}

export function dfmt(s?: string | null) {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export const mlabel = (iso: string, yr?: boolean) => {
  const [y, m] = iso.split("-").map(Number);
  return MON[m - 1] + (yr ? " " + y : "");
};

// Color only ever comes from a goal: green at or above goal or pace, amber close, red behind.
// A number with no goal gets no color, and last year is plain gray text.
export type GoalState = "good" | "near" | "bad";
export const paceClass = (p: number | null | undefined): GoalState | "" => (p == null || !isFinite(p) ? "" : p >= 1 ? "good" : p >= 0.9 ? "near" : "bad");
export const paceWord = (p: number | null | undefined) => (p == null ? "" : p >= 1 ? "On pace" : p >= 0.9 ? "Close" : "Behind");
/** A rate or average against its goal: at or above is green, within 5% of it amber, under that red. */
export const goalClass = (v: number | null | undefined, goal: number | null | undefined): GoalState | "" =>
  v == null || goal == null || !isFinite(v) ? "" : v >= goal ? "good" : v >= goal * 0.95 ? "near" : "bad";
export const goalWord = (c: GoalState | "") => (c === "good" ? "Meets goal" : c === "near" ? "Near goal" : c === "bad" ? "Below goal" : "");
/** "Meets 30% goal", "Near 30% goal", "Below 30% goal". */
export const goalSay = (c: GoalState | "", goal: string) => (c === "good" ? `Meets ${goal} goal` : c === "near" ? `Near ${goal} goal` : c === "bad" ? `Below ${goal} goal` : "");

export const rateValue = (r: Rate) => (r && r.pct != null ? r.pct : null);

// The metric names in the rules' scorecard, in sentence case.
const METRIC: Record<string, string> = {
  "Jobs Sold": "Jobs sold", "Close Rate": "Close rate", "Avg Ticket": "Avg ticket", "Booking Rate": "Booking rate", "Sit Rate": "Sit rate",
  "UG % of Rev": "Upgrades % of revenue", "GP%": "GP %", "Net Profit": "Net profit", "5 Star Reviews": "5-star reviews",
};
export const metricName = (m: string) => METRIC[m] ?? m;
