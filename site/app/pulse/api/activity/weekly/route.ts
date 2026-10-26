import { NextResponse, type NextRequest } from "next/server";
import { etDay, summaryBetween } from "@/lib/pulse/activity";
import { dmAdmin } from "@/lib/pulse/slack";
import { CO } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// Monday morning (Vercel cron, see vercel.json): last week's usage, sent to the admin as a Slack DM.
const shift = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Not allowed", { status: 401 });
  const today = etDay();
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7;
  const from = shift(today, -dow - 7), to = shift(today, -dow - 1);
  const s = await summaryBetween(from, to);
  const active = s.people.filter((p) => p.daysActive), quiet = s.people.filter((p) => !p.daysActive);
  const lines = [
    `:bar_chart: *${CO.pulse_name} usage, ${from} to ${to}*`,
    `${s.activeCount} of ${s.total} people used it · ${mins(s.minutes)} on the site · ${s.asks} Claude questions`,
    ...active.map((p) => `• *${p.name}*: ${p.daysActive} day${p.daysActive === 1 ? "" : "s"}, ${mins(p.minutes)}, ${p.asks.length} question${p.asks.length === 1 ? "" : "s"}`),
    quiet.length ? `Not seen yet: ${quiet.map((p) => p.name).join(", ")}` : "Everyone with a login used it. :fire:",
    `Full detail: ${CO.site_url.replace(/\/$/, "")}/pulse/hq/activity`,
  ];
  const sent = await dmAdmin(lines.join("\n"));
  return NextResponse.json({ ok: true, sent, from, to, active: s.activeCount });
}
