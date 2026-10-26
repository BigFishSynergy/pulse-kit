// Rolls daily activity logs up per person. Shared by the Activity page (in the browser) and the Monday report.
import type { DayLog } from "./activity";

export type PersonSummary = {
  u: string; name: string; role: "rep" | "lead" | "csr"; daysActive: number; signins: number; minutes: number;
  topPages: [string, number][]; asks: { at: string; q: string }[]; graphics: number; requests: number; lastSeen: string | null;
};

/** Roll daily logs up per person, including everyone with a login who never showed up. */
export function summarize(logs: DayLog[], everyone: { u: string; name: string; role: "rep" | "lead" | "csr" }[]): { people: PersonSummary[]; activeCount: number; total: number; minutes: number; asks: number; byDay: Record<string, number> } {
  const by = new Map<string, PersonSummary>();
  for (const u of everyone) by.set(u.u, { u: u.u, name: u.name, role: u.role, daysActive: 0, signins: 0, minutes: 0, topPages: [], asks: [], graphics: 0, requests: 0, lastSeen: null });
  const pages = new Map<string, Record<string, number>>();
  const byDay: Record<string, number> = {};
  for (const d of logs) {
    const p = by.get(d.u) ?? { u: d.u, name: d.name, role: d.role, daysActive: 0, signins: 0, minutes: 0, topPages: [], asks: [], graphics: 0, requests: 0, lastSeen: null };
    p.daysActive += 1; p.signins += d.signins; p.minutes += d.minutes; p.asks.push(...d.asks); p.graphics += d.graphics.length; p.requests += d.requests;
    if (!p.lastSeen || d.last > p.lastSeen) p.lastSeen = d.last;
    const pg = pages.get(d.u) ?? {};
    Object.entries(d.pages).forEach(([k, v]) => (pg[k] = (pg[k] ?? 0) + v));
    pages.set(d.u, pg);
    by.set(d.u, p);
    byDay[d.day] = (byDay[d.day] ?? 0) + 1;
  }
  const people = [...by.values()].map((p) => ({ ...p, asks: p.asks.sort((a, b) => b.at.localeCompare(a.at)), topPages: Object.entries(pages.get(p.u) ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3) }))
    .sort((a, b) => b.minutes - a.minutes || b.daysActive - a.daysActive || a.name.localeCompare(b.name));
  const active = people.filter((p) => p.daysActive > 0);
  return { people, activeCount: active.length, total: people.length, minutes: active.reduce((t, p) => t + p.minutes, 0), asks: active.reduce((t, p) => t + p.asks.length, 0), byDay };
}

export const PAGE_NAMES: Record<string, string> = {
  "/pulse/me": "My numbers", "/pulse/me/reports": "My reports", "/pulse/hq/pulse": "Pulse", "/pulse/hq/reports": "Reports",
  "/pulse/hq/requests": "Requests", "/pulse/hq/activity": "Activity", "/pulse/hq/rep": "A rep's screen",
};
