import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { get, head, put } from "@vercel/blob";
import { users } from "./auth";
import { getCoaching, getFacts, getGeo, getLeadership, getMeta, getPeople, getQuizFile, getRep, getWeeks, hoursOld, type Meta } from "./data";
import { dfmt, mlabel, moneyK, pct } from "./format";
import { aggregate, zero, type Facts, type Totals } from "./ledger";
import { allAttempts, board, quizWeek } from "./quiz";
import type { PulseSlackChannel, SlackBlock } from "./slack";
import { CO, ownerName, TZ } from "./config";

// The daily Slack message to the pulse channel: one each day, built fresh from the Pulse data, posted by the company's
// Pulse Slack app automatically (pulse.config.json slack.daily_messages). Every day is on unless the admin switches it
// off on the Post to Slack page (where they can also send themselves a sample or post one now). The hourly job
// (/pulse/api/notices/daily) posts each day that is on, once, at its local time. Every message links into the Pulse.
// No customer names (jobs by job number only).

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
// `to`: where each one posts. Only Saturday's Speed Round also goes to the sales channel, so the reps get the nudge; it
// holds no company numbers. Everything else carries leadership numbers and stays in the pulse channel.
export const DAILY: { key: DayKey; dow: number; hour: number; time: string; title: string; about: string; to: PulseSlackChannel[] }[] = [
  { key: "mon", dow: 1, hour: 8, time: "Monday 8am", title: "The week", about: "Last week against goal, plus this week's coaching priorities", to: ["pulse"] },
  { key: "tue", dow: 2, hour: 10, time: "Tuesday 10am", title: "Hot and cold", about: "Who's hot and cold out of their last 10 demos, plus player card movers", to: ["pulse"] },
  { key: "wed", dow: 3, hour: 12, time: "Wednesday noon", title: "Pipeline", about: "Open estimates by rep, the ones going stale, and jobs waiting to install", to: ["pulse"] },
  { key: "thu", dow: 4, hour: 14, time: "Thursday 2pm", title: "Leads", about: "The last 7 days of leads by source: booked and sold", to: ["pulse"] },
  { key: "fri", dow: 5, hour: 16, time: "Friday 4pm", title: "Week in review", about: "This week so far against goal, the top 3 reps, jobs installed", to: ["pulse"] },
  { key: "sat", dow: 6, hour: 8, time: "Saturday 8am", title: "Speed Round", about: "Get it in: who has played, the leaderboard, who still needs to", to: ["pulse", "sales"] },
  { key: "sun", dow: 0, hour: 12, time: "Sunday noon", title: "Last call", about: "Speed Round last call, plus what's worth knowing from the coaching cards", to: ["pulse"] },
];
export const isDayKey = (v: unknown): v is DayKey => DAILY.some((d) => d.key === v);
export type DailyMessage = { text: string; blocks: SlackBlock[] };

/* ---------- on/off settings, kept in Blob (local development: a git-ignored folder) ---------- */

export type DaySetting = { on: boolean; sampledAt?: string; lastPosted?: string };
export type DailySettings = Record<DayKey, DaySetting>;
const useBlob = () => !!process.env.VERCEL;
const LOCAL = path.join(process.cwd(), "pipeline", ".cache", "notices");
const SETTINGS = "notices/daily-settings.json";
const sentFile = (date: string) => `notices/daily-sent/${date}.json`;

async function readJson<T>(p: string): Promise<T | null> {
  if (!useBlob()) return fs.readFile(path.join(LOCAL, p), "utf8").then((t) => JSON.parse(t) as T, () => null);
  const r = await get(p, { access: "private", useCache: false }).catch(() => null);
  return r && r.statusCode === 200 ? ((await new Response(r.stream).text().then(JSON.parse)) as T) : null;
}
async function writeJson(p: string, value: unknown) {
  const body = JSON.stringify(value);
  if (!useBlob()) {
    await fs.mkdir(path.dirname(path.join(LOCAL, p)), { recursive: true });
    await fs.writeFile(path.join(LOCAL, p), body);
    return;
  }
  await put(p, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
}

export async function readSettings(): Promise<DailySettings> {
  const s = (await readJson<Partial<DailySettings>>(SETTINGS)) ?? {};
  return Object.fromEntries(DAILY.map((d) => [d.key, { on: true, ...(s[d.key] ?? {}) }])) as DailySettings;
}
export const writeSettings = (s: DailySettings) => writeJson(SETTINGS, s);
export async function sentOn(date: string) {
  if (!useBlob()) return fs.access(path.join(LOCAL, sentFile(date))).then(() => true, () => false);
  return !!(await head(sentFile(date)).catch(() => null));
}
export const markSent = (date: string, key: DayKey) => writeJson(sentFile(date), { key, at: new Date().toISOString() });

/** Now in the company's time zone: weekday (0 Sunday), hour, and the date. */
export function easternNow(d = new Date()) {
  const et = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const date = `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
  return { dow: et.getDay(), hour: et.getHours(), date };
}

/* ---------- Slack layout ---------- */

const SITE = `${CO.site_url.replace(/\/$/, "")}/pulse`;
const PULSE = `${SITE}/hq/pulse`;
// The meter, the cards and production have their own pages since Oct 14 2026 (old #links on the Pulse still forward).
const TEAM = `${SITE}/hq/team`;
const PRODUCTION = `${SITE}/hq/production`;
const header = (text: string): SlackBlock => ({ type: "header", text: { type: "plain_text", text: text.slice(0, 150), emoji: true } });
const md = (text: string): SlackBlock => ({ type: "section", text: { type: "mrkdwn", text: text.slice(0, 2900) } });
const fields = (items: string[]): SlackBlock => ({ type: "section", fields: items.slice(0, 10).map((t) => ({ type: "mrkdwn", text: t })) });
const divider: SlackBlock = { type: "divider" };
const context = (text: string): SlackBlock => ({ type: "context", elements: [{ type: "mrkdwn", text }] });
const link = (url: string, label: string) => `<${url}|${label}>`;
const pace = (p: number | null | undefined) => (p == null || !isFinite(p) ? "⚪" : p >= 1 ? "✅" : p >= 0.9 ? "🟡" : "🔴");
const ratio = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);
const MEDALS = ["🥇", "🥈", "🥉", "4.", "5."];
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** The heads-up line when the data is more than a day old, and the footer every message ends with. */
const stale = (meta: Meta | null): SlackBlock[] => {
  const h = hoursOld(meta);
  return h != null && h > 26 ? [md(`⚠️ *Heads up:* the data was last pulled ${meta?.pulled_at}, more than a day ago, so these numbers may be behind.`)] : [];
};
const footer = (meta: Meta | null, extra = "") => context(`📡 Data pulled ${meta?.pulled_at ?? "(unknown)"}${extra ? `  ·  ${extra}` : ""}  ·  Posted by the ${CO.pulse_name}`);

/* eslint-disable @typescript-eslint/no-explicit-any */
const need = <T>(v: T | null | undefined, what: string): T => {
  if (v == null) throw new Error(`The Pulse data is missing ${what}.`);
  return v;
};

/* ---------- Monday 8am: the week ---------- */

async function monday(): Promise<DailyMessage> {
  const [meta, L] = await Promise.all([getMeta(), getLeadership()]);
  need(meta, "its date"); need(L, "the leadership numbers");
  const wk = L.board?.periods?.week ?? { start: meta!.week_start, end: meta!.week_end };
  const sc = (m: string) => (L.scorecard as any[]).find((s) => s.metric === m);
  const cell = (m: string, label: string): string | null => {
    const s = sc(m);
    if (!s) return null;
    if (s.fmt === "money" && s.weekly_goal) return `${pace(ratio(s.last_week, s.weekly_goal))} *${label}*\n${moneyK(s.last_week)} of ${moneyK(s.weekly_goal)}`;
    if (s.fmt === "money") return `${pace(ratio(s.last_week, s.q_goal))} *${label}*\n${moneyK(s.last_week)} (goal ${moneyK(s.q_goal)})`;
    if (s.fmt === "count") return `${pace(ratio(s.last_week, s.weekly_goal))} *${label}*\n${s.last_week ?? "–"} of ${s.weekly_goal ?? "–"}`;
    const v = s.last_week?.pct ?? null;
    return `${pace(ratio(v, s.q_goal))} *${label}*\n${pct(v, 1)} (goal ${pct(s.q_goal, 0)})`;
  };
  const grid = [
    cell("Sales", "💵 Sales"), cell("Jobs Sold", "🏠 Jobs sold"), cell("Revenue", "🔨 Revenue installed"), cell("Avg Ticket", "🎟️ Avg ticket"),
    cell("Close Rate", "🎯 Close rate (30 days)"), cell("Sit Rate", "🪑 Sit rate"), cell("Leads", "📣 Leads"), cell("Appointments", "📅 Appointments"),
  ].filter(Boolean) as string[];
  const qp = ["Sales", "Jobs Sold", "Revenue", "Leads"].map((m) => sc(m)).filter((s) => s?.pacing != null)
    .map((s) => `${pace(s.pacing)} ${s.metric === "Jobs Sold" ? "Jobs" : s.metric} ${pct(s.pacing, 0)}`).join("   ");
  const c = await getCoaching(meta!.week_start);
  const fresh = c?.generated_at && Date.now() - Date.parse(c.generated_at) < 3 * 864e5;
  const pri: any[] = fresh ? (c.priorities ?? []).slice(0, 4) : [];
  const blocks: SlackBlock[] = [
    header(`📊 Monday kickoff · ${dfmt(wk.start)} to ${dfmt(wk.end)}`),
    ...stale(meta),
    md("*Here's how last week landed against goal.*"),
    fields(grid),
    ...(qp ? [context(`*${meta!.quarter?.label ?? "Quarter"} pace:*   ${qp}`)] : []),
    divider,
    md(pri.length
      ? `*🎯 This week's priorities*\n${pri.map((p, i) => `*${i + 1}. ${p.title}*  (${p.owner})\n      ↳ ${p.first_step}`).join("\n")}`
      : "*🎯 This week's priorities* land in the Pulse with the coaching cards this morning."),
    md(link(PULSE, "📈 Open the Pulse →")),
    footer(meta, "✅ at or above goal  🟡 within 10%  🔴 below"),
  ];
  const s = sc("Sales"), j = sc("Jobs Sold");
  return { text: `📊 Monday kickoff: last week ${moneyK(s?.last_week)} in sales (goal ${moneyK(s?.weekly_goal)}), ${j?.last_week ?? "–"} jobs sold.`, blocks };
}

/* ---------- Tuesday 10am: hot and cold, plus player cards ---------- */

const LEVEL: Record<string, string> = { fire: "🔥 On fire", hot: "♨️ Hot", warm: "🌤️ Warm", cold: "🧊 Cold", ice: "❄️ Ice cold", break: "💤 On break" };

async function tuesday(): Promise<DailyMessage> {
  const [meta, L, weeks] = await Promise.all([getMeta(), getLeadership(), getWeeks()]);
  need(meta, "its date"); need(L, "the leadership numbers");
  const reps: any[] = [...(L.meter?.reps ?? [])].sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0));
  const meterLines = reps.map((r) => `${LEVEL[r.level] ?? r.level}  *${r.rep}*  ·  ${r.sold} sold out of the last 10 demos${r.days_at_level > 1 ? `  ·  ${r.days_at_level} days at this level` : ""}`);
  const win = L.cards?.windows?.["90"] ?? {};
  const cur: any[] = win.cards ?? [];
  const prevWeek = weeks.find((w) => w.week_start < meta!.week_start)?.week_start;
  const P = prevWeek ? await getLeadership(prevWeek) : null;
  const prev = new Map<string, any>((P?.cards?.windows?.["90"]?.cards ?? []).map((c: any) => [c.rep, c]));
  const moves = cur.map((c) => {
    const p = prev.get(c.rep);
    if (!p) return { c, d: null as number | null, why: "" };
    let best = { label: "", diff: 0 };
    for (const [k, s] of Object.entries<any>(c.skills ?? {})) {
      const diff = (s.rating ?? 0) - (p.skills?.[k]?.rating ?? s.rating ?? 0);
      if (Math.abs(diff) > Math.abs(best.diff)) best = { label: s.label, diff };
    }
    return { c, d: c.power - p.power, why: best.diff ? `${best.label} ${best.diff > 0 ? "+" : ""}${best.diff}` : "" };
  });
  const sign = (d: number) => (d > 0 ? `+${d}` : `${d}`);
  const up = moves.filter((m) => m.d != null && m.d >= 2).sort((a, b) => b.d! - a.d!).slice(0, 3);
  const down = moves.filter((m) => m.d != null && m.d <= -2).sort((a, b) => a.d! - b.d!).slice(0, 3);
  const fresh = moves.filter((m) => m.d == null && prev.size);
  const cardLines: string[] = [];
  if (up.length) cardLines.push(`📈 *Climbing:* ${up.map((m) => `${m.c.rep} ${m.c.power} (${sign(m.d!)}${m.why ? `, ${m.why}` : ""})`).join("  ·  ")}`);
  if (down.length) cardLines.push(`📉 *Slipping:* ${down.map((m) => `${m.c.rep} ${m.c.power} (${sign(m.d!)}${m.why ? `, ${m.why}` : ""})`).join("  ·  ")}`);
  if (!up.length && !down.length) cardLines.push(`➖ *No big moves this week:* ${moves.map((m) => `${m.c.rep} ${m.c.power}${m.d ? ` (${sign(m.d)})` : ""}`).join("  ·  ")}`);
  if (fresh.length) cardLines.push(`🆕 *New card:* ${fresh.map((m) => `${m.c.rep} ${m.c.power}`).join(", ")}`);
  const one = L.cards?.record?.number_one;
  if (one) cardLines.push(`👑 *#1:* ${one.rep} (${one.power}), ${plural(one.weeks, "week")} running`);
  const coming: any[] = win.coming ?? [];
  if (coming.length) cardLines.push(`🔓 *Cards coming:* ${coming.map((c) => `${c.rep} (${c.demos} of ${c.needed} demos)`).join(", ")}`);
  // Same-day closes, last 90 days: the top 3 on the board (deals.py, minimum demos to qualify).
  const SD = L.same_day;
  const sdTop: any[] = (SD?.reps ?? []).filter((r: any) => r.rank).sort((a: any, b: any) => a.rank - b.rank).slice(0, 3);
  const sameDay = SD && sdTop.length
    ? `*⚡ Same-day closes* (signed the day of the demo, last ${SD.days} days)\n${sdTop.map((r, i) => `${MEDALS[i]}  *${r.rep}*  ·  ${pct(r.pct, 0)} (${r.n} of ${r.of})`).join("\n")}\nTeam: ${pct(SD.team.pct, 0)} (${SD.team.n} of ${SD.team.of})`
    : "";
  const blocks: SlackBlock[] = [
    header("🔥 Who's hot, who's not"),
    ...stale(meta),
    md(meterLines.length ? meterLines.join("\n") : "No meter readings yet."),
    divider,
    md(`*⚾ Player cards this week*\n${cardLines.join("\n")}`),
    ...(sameDay ? [divider, md(sameDay)] : []),
    md(`${link(`${TEAM}#meter`, "🔥 The meter →")}     ${link(`${TEAM}#cards`, "⚾ The cards →")}`),
    footer(meta, "Cards cover each rep's last 90 days"),
  ];
  const top = reps[0];
  return { text: `🔥 Who's hot: ${top ? `${top.rep} (${LEVEL[top.level] ?? top.level}, ${top.sold} of 10)` : "the meter"}. Player cards inside.`, blocks };
}

/* ---------- Wednesday noon: pipeline ---------- */

async function wednesday(): Promise<DailyMessage> {
  const [meta, L, G, people] = await Promise.all([getMeta(), getLeadership(), getGeo(), getPeople()]);
  need(meta, "its date"); need(L, "the leadership numbers");
  const open = Object.values<any>(G?.open ?? {});
  const openN = open.reduce((a, b) => a + (b.count ?? 0), 0), openV = open.reduce((a, b) => a + (b.value ?? 0), 0);
  const roster: { rep: string; slug: string }[] = people?.roster ?? [];
  const reps = (await Promise.all(roster.map(async (r) => ({ r, f: (await getRep(r.slug))?.follow_ups })))).filter((x) => x.f?.count);
  reps.sort((a, b) => (b.f.quoted_total ?? 0) - (a.f.quoted_total ?? 0));
  const days = reps[0]?.f?.window_days;
  const repLines = reps.map(({ r, f }) => {
    // The list holds the newest 40 (newest first), so the ones left off are older than the oldest shown.
    const rows: any[] = f.rows ?? [];
    const hidden = Math.max(0, f.count - rows.length), oldest = Math.max(0, ...rows.map((x) => x.days ?? 0));
    const old = rows.filter((x) => (x.days ?? 0) >= 14).length + (hidden && oldest >= 14 ? hidden : 0);
    const atLeast = hidden > 0 && oldest < 14;
    return `•  ${link(`${SITE}/hq/rep/${r.slug}`, r.rep)}:  *${f.count}* open  ·  ${moneyK(f.quoted_total)}${old ? `  ·  ⏳ ${atLeast ? "at least " : ""}${old} over 2 weeks old` : ""}`;
  });
  const ins = L.installs ?? {};
  const risk: any[] = ins.at_risk ?? [];
  const blocks: SlackBlock[] = [
    header("💰 Mid-week pipeline check"),
    ...stale(meta),
    md(`*${openN.toLocaleString("en-US")} open estimates* worth *${moneyK(openV)}*, quoted in the last ${G?.open_days ?? "–"} days.`),
    ...(repLines.length ? [md(`*📋 Follow-ups by rep*${days ? ` (quoted in the last ${days} days)` : ""}\n${repLines.join("\n")}`)] : []),
    divider,
    md([
      `*🔨 Sold, waiting to install:* ${plural((ins.to_install ?? []).length, "job")}  ·  ${moneyK(ins.to_install_total)}`,
      ins.past_date_still_approved ? `📆 ${plural(ins.past_date_still_approved, "job")} past the install date, still approved` : "",
      ...risk.slice(0, 5).map((x) => `⚠️ *At risk:* ${x.rr} (${x.rep})  ·  ${x.status}  ·  ${dfmt(x.date)}`),
    ].filter(Boolean).join("\n")),
    md(`${link(PULSE, "💰 Open the Pulse →")}     ${link(PRODUCTION, "🔨 Production →")}`),
    footer(meta, "Click a rep for their follow-up list"),
  ];
  return { text: `💰 Pipeline: ${openN} open estimates worth ${moneyK(openV)}; ${(ins.to_install ?? []).length} jobs waiting to install.`, blocks };
}

/* ---------- Thursday 2pm: leads ---------- */

async function thursday(): Promise<DailyMessage> {
  const [meta, L, F] = await Promise.all([getMeta(), getLeadership(), getFacts() as Promise<Facts | null>]);
  need(meta, "its date"); need(L, "the leadership numbers"); need(F, "the report ledger");
  const end = meta!.as_of, start = addDays(end, -6);
  const sum = (m: Map<string, Map<string, Totals>>) => [...m.entries()].map(([k, row]) => ({ k, t: row.get("All") ?? zero() }));
  const now = sum(aggregate(F!, start, end, { closeTeam: true }, "src")).filter((x) => x.t.leads || x.t.appointments || x.t.jobs);
  const before = sum(aggregate(F!, addDays(end, -13), addDays(end, -7), { closeTeam: true }, "src"));
  const leads = now.reduce((a, x) => a + x.t.leads, 0), appts = now.reduce((a, x) => a + x.t.appointments, 0);
  const leadsBefore = before.reduce((a, x) => a + x.t.leads, 0);
  const change = leadsBefore ? Math.round(((leads - leadsBefore) / leadsBefore) * 100) : null;
  const leadRow = (L.scorecard as any[]).find((s) => s.metric === "Leads");
  const goal = leadRow?.weekly_goal;
  const owner = leadRow?.owner ? ownerName(leadRow.owner) : "";
  now.sort((a, b) => b.t.leads - a.t.leads || b.t.sales - a.t.sales);
  const nice = (x: string) => (x === x.toUpperCase() ? x.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()) : x);
  const lines = now.slice(0, 7).map(({ k, t }) => `•  *${nice(k)}*:  ${t.leads} ${t.leads === 1 ? "lead" : "leads"}  ·  ${t.appointments} booked${t.jobs ? `  ·  ${t.jobs} sold (${moneyK(t.sales)})` : ""}`);
  const spend = L.marketing?.spend;
  const lastSpend: string | undefined = spend?.months?.[spend.months.length - 1];
  const monthsBehind = lastSpend ? (+end.slice(0, 4) - +lastSpend.slice(0, 4)) * 12 + (+end.slice(5, 7) - +lastSpend.slice(5, 7)) : null;
  const spendLine = monthsBehind == null ? "💸 No marketing spend entered yet, so there's no cost per lead to show."
    : monthsBehind > 1 ? `💸 Marketing spend is entered through ${mlabel(lastSpend!, true)}. Fill in the months since to see cost per lead by channel.`
    : `💸 *Cost per lead (${mlabel(lastSpend!)}):* ${(spend.lines ?? []).filter((x: any) => x.cost_per_lead).slice(0, 4).map((x: any) => `${x.line} ${moneyK(x.cost_per_lead)}`).join("  ·  ")}`;
  const blocks: SlackBlock[] = [
    header(`📣 Leads · ${dfmt(start)} to ${dfmt(end)}`),
    ...stale(meta),
    fields([
      `${pace(ratio(leads, goal))} *Leads*\n${leads}${goal ? ` (goal ${goal} a week)` : ""}`,
      `*📈 vs the 7 days before*\n${change == null ? "–" : `${change >= 0 ? "+" : ""}${change}% (${leadsBefore})`}`,
      `*📅 Booked*\n${appts}`,
      `*🎯 Booking rate*\n${pct(ratio(appts, leads), 0)}`,
    ]),
    md(lines.length ? `*Where they came from*\n${lines.join("\n")}` : "No leads logged in the last 7 days."),
    md(spendLine),
    md(`${link(`${SITE}/hq/moneyball`, "🎯 Where to advertise (Moneyball) →")}     ${link(`${SITE}/hq/reports`, "📊 Reports →")}`),
    footer(meta, owner ? `Owner: ${owner.split(" ")[0]}` : ""),
  ];
  return { text: `📣 Leads, last 7 days: ${leads}${goal ? ` (goal ${goal})` : ""}, ${appts} booked.`, blocks };
}

/* ---------- Friday 4pm: week in review ---------- */

async function friday(): Promise<DailyMessage> {
  const [meta, L, F] = await Promise.all([getMeta(), getLeadership(), getFacts() as Promise<Facts | null>]);
  need(meta, "its date"); need(L, "the leadership numbers"); need(F, "the report ledger");
  const mon = quizWeek(), end = meta!.as_of < mon ? mon : meta!.as_of;
  const t = aggregate(F!, mon, end, { closeTeam: true }).get("All")?.get("All") ?? zero();
  const goal = (m: string) => (L.scorecard as any[]).find((s) => s.metric === m)?.weekly_goal;
  const byRep = [...aggregate(F!, mon, end, { teamOnly: true }, "rep").entries()].map(([rep, row]) => ({ rep, t: row.get("All") ?? zero() }))
    .filter((x) => x.t.sales > 0).sort((a, b) => b.t.sales - a.t.sales).slice(0, 3);
  const ins = L.installs?.week_start === mon ? L.installs : null;
  const one = L.cards?.record?.number_one;
  const blocks: SlackBlock[] = [
    header(`🏁 Week in review · ${mon === end ? dfmt(mon) : `${dfmt(mon)} to ${dfmt(end)}`}`),
    ...stale(meta),
    md("*The week so far against the weekly goal.*"),
    fields([
      `${pace(ratio(t.sales, goal("Sales")))} *💵 Sales*\n${moneyK(t.sales)} of ${moneyK(goal("Sales"))}`,
      `${pace(ratio(t.jobs, goal("Jobs Sold")))} *🏠 Jobs sold*\n${t.jobs} of ${goal("Jobs Sold") ?? "–"}`,
      `${pace(ratio(t.revenue, goal("Revenue")))} *🔨 Revenue installed*\n${moneyK(t.revenue)} of ${moneyK(goal("Revenue"))}`,
      `${pace(ratio(t.sits, goal("Sits")))} *🪑 Sits*\n${t.sits} of ${goal("Sits") ?? "–"}`,
      `*🎯 Close rate*\n${pct(ratio(t.cr, t.cs), 0)} (${t.cr} signed of ${t.cs} demos)`,
      `${pace(ratio(t.leads, goal("Leads")))} *📣 Leads*\n${t.leads} of ${goal("Leads") ?? "–"}`,
    ]),
    divider,
    md(byRep.length ? `*🏆 Top reps this week*\n${byRep.map((x, i) => `${MEDALS[i]}  *${x.rep}*  ·  ${moneyK(x.t.sales)}  ·  ${plural(x.t.jobs, "job")}`).join("\n")}` : "*🏆 Top reps this week:* no sales logged yet this week."),
    md([
      ins ? `🔨 *${plural((ins.installed ?? []).length, "job")} installed this week*  ·  ${moneyK(ins.installed_total)}` : "",
      one ? `👑 ${one.rep} holds #1 on the player cards (${one.power}), ${plural(one.weeks, "week")} running` : "",
    ].filter(Boolean).join("\n") || "Have a great weekend."),
    md(link(PULSE, "🏁 Open the Pulse →")),
    footer(meta, "✅ at or above goal  🟡 within 10%  🔴 below"),
  ];
  return { text: `🏁 Week in review: ${moneyK(t.sales)} in sales, ${t.jobs} jobs sold so far this week.`, blocks };
}

/* ---------- Saturday 8am and Sunday noon: the Speed Round ---------- */

async function speedRound() {
  const week = quizWeek();
  const [quiz, attempts] = await Promise.all([getQuizFile(week), allAttempts(week)]);
  const b = board(attempts);
  const players = users().filter((u) => !u.view && u.u !== "guest" && u.u !== "leadteam" && !u.expires);
  const played = new Set(b.map((x) => x.u));
  const waiting = players.filter((u) => !played.has(u.u)).map((u) => u.name);
  const top = b.slice(0, 5).map((x, i) => `${MEDALS[i]}  *${x.name}*  ·  ${x.score.toLocaleString("en-US")} pts  (${x.right}/${x.n} right, ${x.secs}s)`);
  return { ready: !!quiz, played: b.length, total: players.length, top, waiting };
}

async function saturday(): Promise<DailyMessage> {
  const meta = await getMeta();
  const q = await speedRound();
  const blocks: SlackBlock[] = [
    header("🧠 Speed Round Saturday: get it in!"),
    md(q.ready
      ? `*${q.played} of ${q.total} have played this week.* Ten questions, 15 seconds each, all from memory. Get yours in before the board resets Monday morning. ⏱️`
      : "This week's Speed Round isn't out yet. It goes up with Monday's data."),
    ...(q.top.length ? [md(`*🏆 Leaderboard*\n${q.top.join("\n")}`)] : []),
    ...(q.ready && q.waiting.length ? [md(`*⏳ Still to play:* ${q.waiting.join(", ")}`)] : []),
    md("👊 *Everybody in.* Reps play from the Speed Round tab in their Pulse, leaders from the leadership Pulse."),
    md(`${link(`${SITE}/me/game`, "🎮 Reps: play here →")}     ${link(`${SITE}/hq/game`, "🎮 Leaders: play here →")}`),
    footer(meta),
  ];
  return { text: `🧠 Speed Round Saturday: ${q.played} of ${q.total} have played. Get it in!`, blocks };
}

async function sunday(): Promise<DailyMessage> {
  const meta = await getMeta();
  const [q, c] = await Promise.all([speedRound(), meta ? getCoaching(meta.week_start) : Promise.resolve(null)]);
  const worth: string[] = (c?.worth_knowing ?? []).slice(0, 3);
  const blocks: SlackBlock[] = [
    header("📌 Sunday: last call + worth knowing"),
    md(q.ready
      ? `⏰ *Last call on the Speed Round.* The board resets tomorrow morning. *${q.played} of ${q.total}* have played.`
      : "⏰ No Speed Round this week."),
    ...(q.top.length ? [md(`*🏆 Top of the board*\n${q.top.slice(0, 3).join("\n")}`)] : []),
    ...(q.ready && q.waiting.length ? [md(`*⏳ Still to play:* ${q.waiting.join(", ")}`)] : []),
    divider,
    md(worth.length ? `*💡 Worth knowing going into the week*\n${worth.map((w) => `•  ${w}`).join("\n")}` : "*💡 Worth knowing:* the new coaching cards land tomorrow morning."),
    md(`${link(`${SITE}/hq/game`, "🎮 Play the Speed Round →")}     ${link(PULSE, "📈 Open the Pulse →")}`),
    footer(meta),
  ];
  return { text: `📌 Last call: ${q.played} of ${q.total} have played the Speed Round.`, blocks };
}

const BUILD: Record<DayKey, () => Promise<DailyMessage>> = { mon: monday, tue: tuesday, wed: wednesday, thu: thursday, fri: friday, sat: saturday, sun: sunday };
/** Build one day's message from the latest Pulse data. Throws if the data it needs is missing. */
export const buildDaily = (key: DayKey) => BUILD[key]();
