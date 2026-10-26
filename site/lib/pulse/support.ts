import { CO, CONFIG } from "./config";

// Where leadership's "Message Benny" and "Help with my brand" links go: an email to the Pulse Kit's maker
// (pulse.config.json support), opened in their own mail app, with the company and the site filled in. Nothing is sent
// on its own, and no numbers or customer data are attached.
const S = CONFIG.support;
const mail = (subject: string, body: string) => `mailto:${S.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const supportLinks = () => ({
  help: mail(`Pulse help: ${CO.name}`, `Hi ${S.name.split(" ")[0]},\n\nWe're on the ${CO.pulse_name} (${CO.site_url}). Here's what's going on:\n\n`),
  brand: mail(`Brand help: ${CO.name}`, `Hi ${S.name.split(" ")[0]},\n\nWe'd like help with our brand for ${CO.name}. Here's where we are:\n\n`),
  site: S.site, call: S.call, name: S.name, title: S.title,
});

// The tip card: shown only when a scorecard number has been behind its goal in 3 of the last 4 weeks, one card at a
// time, naming the area of the business it belongs to. Leadership only; pages.tips switches it off.
const AREA: Record<string, { area: string; line: string }> = {
  appts: { area: "marketing", line: "Steady appointments start with marketing that feeds the calendar." },
  appts_30: { area: "marketing", line: "Steady appointments start with marketing that feeds the calendar." },
  demos: { area: "marketing", line: "More demos usually starts upstream, with the leads coming in." },
  sit_rate: { area: "sales training", line: "Sit rate moves when the whole team runs the same process from the first call." },
  sales: { area: "sales training", line: "Sales follow the process: the same steps, every appointment." },
  close: { area: "sales training", line: "Close rate is a process number before it's a people number." },
  ticket: { area: "sales training", line: "Average ticket grows when every homeowner sees good, better and best." },
  backlog: { area: "production", line: "A healthy backlog is a planning rhythm between sales and production." },
  revenue: { area: "production", line: "Revenue completed comes from a production calendar the team can trust." },
  gp: { area: "finance", line: "Gross profit is set at the table and protected in production." },
  ar30: { area: "finance", line: "Money owed comes in faster with a simple collections rhythm." },
  reviews: { area: "brand", line: "Five-star reviews follow a brand promise the whole team keeps." },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function tipFrom(scoreboard: any): { key: string; label: string; area: string; line: string; weeks: number } | null {
  const tiles: any[] = scoreboard?.periods?.week?.tiles ?? [];
  const behind = tiles.map((t) => {
    if (!AREA[t.key] || typeof t.goal !== "number" || !Array.isArray(t.hist) || t.hist.length < 4) return null;
    const less = t.key === "ar30";
    const last = t.hist.slice(-4).map((v: any) => (typeof v === "number" ? v : v?.pct ?? null));
    const off = last.filter((v: number | null) => v != null && (less ? v > t.goal : v < t.goal * 0.95)).length;
    return off >= 3 && t.status === "bad" ? { key: t.key, label: t.label, ...AREA[t.key], weeks: off, sev: t.sev ?? 0 } : null;
  }).filter(Boolean) as any[];
  behind.sort((a, b) => b.sev - a.sev);
  return behind[0] ? { key: behind[0].key, label: behind[0].label, area: behind[0].area, line: behind[0].line, weeks: behind[0].weeks } : null;
}
