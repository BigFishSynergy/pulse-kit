import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";
import { getFacts, getLeadership, getMeta } from "./data";
import { aggregate, zero, type Facts } from "./ledger";
import { dfmt } from "./format";
import { photoIndex } from "./photos";

// TV screens: a page for a TV in the office that cycles through a few big slides and refreshes itself. The admin sets
// each one up on the TV screens page (/pulse/hq/tv) by answering a few questions: where it hangs, who watches it, which
// slides, how long each stays up. Each TV gets its own view-only link (/pulse/tv/<token>), stored only as a hash;
// removing a TV stops its link. A sales floor TV never shows company margins, cash, A/R or the scorecard.

export type Audience = "floor" | "office";
export type Screen = { id: string; name: string; audience: Audience; slides: string[]; seconds: number; dark: boolean; key: string; at: string };

export const SLIDES: { key: string; title: string; about: string; office?: boolean }[] = [
  { key: "week", title: "This week", about: "Sales, jobs sold, sits and leads so far this week, against the weekly goals" },
  { key: "power", title: "POWER rankings", about: "Every rep's POWER and this month's sales, highest first" },
  { key: "hotcold", title: "Hot and cold", about: "Who's on fire out of their last 10 demos" },
  { key: "leaders", title: "Month leaders", about: "Top reps by sales this month" },
  { key: "installs", title: "Installs", about: "Jobs installed this week and what's coming up" },
  { key: "pace", title: "Quarter pace", about: "Sales and revenue this quarter against the goal and the pace line" },
  { key: "scorecard", title: "Scorecard", about: "Last week's leadership scorecard, each box green, amber or red", office: true },
  { key: "money", title: "Money", about: "GP %, backlog and money owed over 30 days", office: true },
  { key: "sources", title: "Lead sources", about: "Leads and sales by source this month", office: true },
];
export const slideOk = (key: string, aud: Audience) => SLIDES.some((s) => s.key === key && (aud === "office" || !s.office));

const FILE = "tv/screens.json";
const LOCAL = path.join(process.cwd(), "pipeline", ".cache", "tv-screens.json");
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);
const sha = (t: string) => createHash("sha256").update(t).digest("base64url");

export async function listScreens(): Promise<Screen[]> {
  try {
    if (useBlob()) {
      const r = await get(FILE, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return [];
      return JSON.parse(await new Response(r.stream).text());
    }
    return JSON.parse(await fs.readFile(LOCAL, "utf8"));
  } catch {
    return [];
  }
}

export async function saveScreens(list: Screen[]) {
  const body = JSON.stringify(list);
  if (useBlob()) await put(FILE, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  else { await fs.mkdir(path.dirname(LOCAL), { recursive: true }); await fs.writeFile(LOCAL, body); }
}

/** A new link token for a screen: the token goes back once, only its hash is kept. */
export function newKey(): { token: string; key: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, key: sha(token) };
}

export async function screenFor(token: string): Promise<Screen | null> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const h = Buffer.from(sha(token));
  return (await listScreens()).find((s) => s.key.length === h.length && timingSafeEqual(Buffer.from(s.key), h)) ?? null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const monday = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); return addDays(iso, -((d.getUTCDay() + 6) % 7)); };

/** Only what the chosen slides need, and nothing a floor TV may not show. Never links, never customer data. */
export async function slideData(s: Screen) {
  const [meta, L, F] = await Promise.all([getMeta(), getLeadership(), getFacts() as Promise<Facts | null>]);
  if (!meta || !L || !F) return { meta: null, slides: [] as any[] };
  const asOf = meta.as_of, mon = monday(asOf), m0 = asOf.slice(0, 8) + "01";
  const goal = (m: string) => (L.scorecard as any[]).find((x) => x.metric === m)?.weekly_goal ?? null;
  const out: any[] = [];
  for (const key of s.slides.filter((k) => slideOk(k, s.audience))) {
    if (key === "week") {
      const t = aggregate(F, mon, asOf, { closeTeam: true }).get("All")?.get("All") ?? zero();
      out.push({ key, title: "This week", sub: `${dfmt(mon)} to ${dfmt(asOf)}`, tiles: [
        { label: "Sales", money: true, value: t.sales, goal: goal("Sales") }, { label: "Jobs sold", value: t.jobs, goal: goal("Jobs Sold") },
        { label: "Sits", value: t.sits, goal: goal("Sits") }, { label: "Leads", value: t.leads, goal: goal("Leads") }] });
    } else if (key === "power") {
      const W = Object.values(L.cards?.windows ?? {})[0] as any;
      const month = aggregate(F, m0, asOf, { teamOnly: true }, "rep");
      const ph = await photoIndex();
      const cards = (W?.cards ?? []).slice(0, 12).map((c: any) => ({
        name: c.rep, slug: c.slug, photo: ph[c.slug] ?? null, rank: c.rank, power: c.power, ups: c.power_ups ?? [],
        skills: ["money", "closer", "ticket", "hustle", "rapid", "selfgen"].filter((k) => c.skills?.[k]).map((k) => ({ label: c.skills[k].label, rating: c.skills[k].rating })),
        sales: month.get(c.rep)?.get("All")?.sales ?? 0 }));
      // four cards to a slide, so every card reads from across the room
      for (let i = 0; i < cards.length; i += 4)
        out.push({ key: i ? `${key}-${i}` : key, title: "POWER rankings", sub: cards.length > 4 ? `${i + 1} to ${Math.min(i + 4, cards.length)} of ${cards.length}, last 90 days` : "Last 90 days", cards: cards.slice(i, i + 4) });
    } else if (key === "hotcold") {
      const M = L.meter;
      const lab = Object.fromEntries((M?.levels ?? []).map((l: any) => [l.key, l.label]));
      out.push({ key, title: "Hot and cold", sub: "Out of each rep's last 10 demos", rows: (M?.reps ?? []).filter((r: any) => r.level && r.level !== "break")
        .sort((a: any, b: any) => b.sold - a.sold).slice(0, 10).map((r: any) => ({ name: r.rep, sold: r.sold, level: r.level, label: lab[r.level] ?? r.level })) });
    } else if (key === "leaders") {
      const month = [...aggregate(F, m0, asOf, { teamOnly: true }, "rep").entries()].map(([rep, row]) => ({ name: rep, t: row.get("All") ?? zero() }))
        .filter((x) => x.t.sales > 0).sort((a, b) => b.t.sales - a.t.sales).slice(0, 5);
      out.push({ key, title: "Month leaders", sub: `Since ${dfmt(m0)}`, rows: month.map((x) => ({ name: x.name, sales: x.t.sales, jobs: x.t.jobs })) });
    } else if (key === "installs") {
      const I = L.installs ?? {};
      out.push({ key, title: "Installs", sub: `Week of ${dfmt(I.week_start ?? mon)}`, tiles: [
        { label: "Installed this week", value: (I.installed ?? []).length }, { label: "Installed $", money: true, value: I.installed_total ?? 0 },
        { label: "Still to install", value: (I.to_install ?? []).length }, { label: "Scheduled overall", money: true, value: I.in_progress_total ?? 0 }] });
    } else if (key === "pace") {
      const row = (m: string) => (L.board?.rows ?? []).find((r: any) => r.metric === m);
      out.push({ key, title: L.quarter?.label ?? "This quarter", sub: `Day ${L.quarter?.days_elapsed ?? "?"} of ${L.quarter?.days_total ?? "?"}`,
        bars: ["Sales", "Revenue"].map((m) => { const r = row(m); return { label: m, value: r?.values?.quarter ?? 0, goal: r?.goal?.quarter ?? null, pace: r?.goal?.quarter_pace ?? null }; }) });
    } else if (key === "scorecard") {
      const P = L.scoreboard?.periods?.week;
      out.push({ key, title: "Scorecard", sub: P ? `${dfmt(P.start)} to ${dfmt(P.end)}` : "", boxes: (P?.tiles ?? []).map((t: any) => ({ label: t.label, value: t.value, fmt: t.fmt, status: t.status, owner: t.owner })) });
    } else if (key === "money") {
      const sb = (k: string) => (L.scoreboard?.periods?.week?.tiles ?? []).find((t: any) => t.key === k);
      out.push({ key, title: "Money", tiles: [
        { label: "GP % (30 days)", pct: true, value: sb("gp")?.value ?? null, status: sb("gp")?.status }, { label: "Backlog", money: true, value: sb("backlog")?.value ?? null, status: sb("backlog")?.status },
        { label: "Owed over 30 days", money: true, value: sb("ar30")?.value ?? null, status: sb("ar30")?.status }] });
    } else if (key === "sources") {
      const rows = [...aggregate(F, m0, asOf, { closeTeam: true }, "src").entries()].map(([src, row]) => ({ name: src, t: row.get("All") ?? zero() }))
        .filter((x) => x.t.leads > 0 && !x.name.startsWith("(")).sort((a, b) => b.t.leads - a.t.leads).slice(0, 8);
      out.push({ key, title: "Lead sources", sub: `Since ${dfmt(m0)}`, rows: rows.map((x) => ({ name: x.name, leads: x.t.leads, sales: x.t.sales })) });
    }
  }
  return { meta: { pulled_at: meta.pulled_at, as_of: asOf }, slides: out };
}
