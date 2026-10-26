import "server-only";
import { get, list, put } from "@vercel/blob";
import type { Session } from "./auth";
import { users } from "./auth";
import { TZ } from "./config";

// Who uses the Pulse and how: one small private file per person per day (Eastern time).
// Sign-ins, pages, active minutes (only while the tab is open and someone is using it), Claude questions,
// graphics and requests. Leadership reads it on the Activity page and in the Monday Slack report.

export type DayLog = {
  u: string; name: string; role: "rep" | "lead" | "csr"; day: string;
  first: string; last: string; lastBeat?: string;
  signins: number; minutes: number; pages: Record<string, number>;
  asks: { at: string; q: string }[]; graphics: { at: string; p: string }[]; requests: number; music: number;
};
export type Kind = "signin" | "page" | "beat" | "ask" | "graphic" | "request" | "music";

// Local development writes to its own folder, so testing never shows up in the real report.
const PREFIX = process.env.VERCEL ? "activity/" : "dev-activity/";

export const etDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const r = await get(path, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text()) as T;
  } catch {
    return null;
  }
}

/** Never throws: activity logging must not break a page. */
export async function record(s: Session | null, kind: Kind, detail?: string) {
  if (!s || !(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL)) return;
  try {
    const now = new Date(), day = etDay(now), at = now.toISOString();
    const path = `${PREFIX}${day}/${s.u}.json`;
    const d: DayLog = (await readJson<DayLog>(path)) ?? {
      u: s.u, name: s.name, role: s.role, day, first: at, last: at, signins: 0, minutes: 0, pages: {}, asks: [], graphics: [], requests: 0, music: 0,
    };
    if (kind === "beat") {
      // at most one active minute per 50 seconds, however many tabs are open
      if (d.lastBeat && now.getTime() - Date.parse(d.lastBeat) < 50_000) return;
      d.minutes += 1;
      d.lastBeat = at;
    }
    if (kind === "signin") d.signins += 1;
    if (kind === "page" && detail) {
      const p = detail.replace(/\?.*$/, "").replace(/\/pulse\/hq\/rep\/[a-z0-9-]+/, "/pulse/hq/rep").slice(0, 80);
      d.pages[p] = (d.pages[p] ?? 0) + 1;
    }
    if (kind === "ask" && detail) d.asks = [...d.asks, { at, q: detail.slice(0, 400) }].slice(-50);
    if (kind === "graphic" && detail) d.graphics = [...d.graphics, { at, p: detail.slice(0, 300) }].slice(-30);
    if (kind === "request") d.requests += 1;
    if (kind === "music") d.music += 1;
    d.last = at;
    await put(path, JSON.stringify(d), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  } catch {}
}

/** Every person's daily logs between two Eastern dates, both included. */
export async function logsBetween(from: string, to: string): Promise<DayLog[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const day = b.pathname.slice(PREFIX.length, PREFIX.length + 10);
      if (day >= from && day <= to) paths.push(b.pathname);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const out: DayLog[] = [];
  for (let i = 0; i < paths.length; i += 20) {
    const batch = await Promise.all(paths.slice(i, i + 20).map((p) => readJson<DayLog>(p)));
    batch.forEach((x) => x && out.push(x));
  }
  return out;
}

export { summarize, PAGE_NAMES, type PersonSummary } from "./activity-summary";
import { summarize as _summarize } from "./activity-summary";

/** Summary for a date range, with everyone who has a login listed even if they never showed up. */
export async function summaryBetween(from: string, to: string) {
  const logs = await logsBetween(from, to);
  return _summarize(logs, (await users()).map(({ u, name, role }) => ({ u, name, role })));
}
