import { NextResponse, type NextRequest } from "next/server";
import { getSession, isAdmin } from "@/lib/pulse/auth";
import { CO } from "@/lib/pulse/config";
import { buildDaily, DAILY, isDayKey, readSettings, writeSettings } from "@/lib/pulse/daily";
import { dmAdmin, isPulseSlackChannel, postApproved, PULSE_SLACK_CHANNELS, slackConnected, slackReady } from "@/lib/pulse/slack";
import { pageOn } from "@/lib/pulse/config";

// The company's Pulse Slack app (lib/pulse/slack.ts). The admin only.
// GET: whether the app's settings are in place and Slack accepts its token (Slack's auth.test: sends nothing), yes or
// no, never the values.
// POST { action: "test" }: a test DM to the admin.
// POST { action: "post", to, text }: the admin posts their own message, exactly as written, to their DMs or one of the
// channels the app is in.
// POST { action: "daily.sample" | "daily.post" | "daily.switch", day, on? }: the daily Pulse messages
// (lib/pulse/daily.ts), which post on their own: a sample to the admin's DMs, post one now, or switch a day off and on.
export const dynamic = "force-dynamic";

const WHY: Record<string, string> = {
  not_in_channel: "The Pulse app is not in that channel. Add it in the channel's settings (Agents & apps).",
  channel_not_found: "Slack cannot find that channel for the app. Add the app in the channel's settings.",
  not_configured: "Slack is not set up yet: the app's token or your member ID is missing.",
  not_live_site: "Only the live site sends to Slack.",
  invalid_auth: "Slack did not accept the app's token. It may need a new one.",
  account_inactive: "Slack did not accept the app's token. It may need a new one.",
};

export async function GET() {
  if (!pageOn("slack")) return new Response("Not found", { status: 404 });
  return NextResponse.json({ ready: slackReady(), live: process.env.VERCEL_ENV === "production", connected: await slackConnected() });
}

export async function POST(req: NextRequest) {
  if (!pageOn("slack")) return new Response("Not found", { status: 404 });
  if (!isAdmin((await getSession()))) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (!slackReady()) return NextResponse.json({ error: WHY.not_configured }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; to?: string; text?: string; day?: string; on?: boolean };
  if (b.action?.startsWith("daily.")) {
    if (!isDayKey(b.day)) return NextResponse.json({ error: "Pick a day." }, { status: 400 });
    const day = b.day, info = DAILY.find((d) => d.key === day)!;
    const settings = await readSettings();
    if (b.action === "daily.switch") {
      settings[day].on = !!b.on;
      await writeSettings(settings);
      return NextResponse.json({ ok: true, settings });
    }
    let msg;
    try { msg = await buildDaily(day); } catch (e) { return NextResponse.json({ error: `Could not build ${info.title}: ${(e as Error).message}` }, { status: 500 }); }
    if (b.action === "daily.sample") {
      const sent = await dmAdmin(msg.text, msg.blocks);
      if (!sent) return NextResponse.json({ error: "Slack did not take the sample.", preview: process.env.VERCEL ? undefined : msg }, { status: 502 });
      settings[day].sampledAt = new Date().toISOString();
      await writeSettings(settings);
      return NextResponse.json({ ok: true, settings });
    }
    if (b.action === "daily.post") {
      const rs = await Promise.all(info.to.map((to) => postApproved(to, msg.text, msg.blocks)));
      const bad = rs.find((r) => !r.ok);
      if (bad && !bad.ok) return NextResponse.json({ error: WHY[bad.reason] ?? `Slack did not take it (${bad.reason}).` }, { status: 502 });
      settings[day].lastPosted = new Date().toISOString();
      await writeSettings(settings);
      return NextResponse.json({ ok: true, settings });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (b.action === "post") {
    const text = typeof b.text === "string" ? b.text.trim() : "";
    if (!text || text.length > 3500) return NextResponse.json({ error: "Write the message first (up to 3,500 characters)." }, { status: 400 });
    if (b.to === "me") return (await dmAdmin(text)) ? NextResponse.json({ ok: true, to: "your DMs" }) : NextResponse.json({ error: "Slack did not take it." }, { status: 502 });
    if (!isPulseSlackChannel(b.to)) return NextResponse.json({ error: "Pick where it goes." }, { status: 400 });
    const r = await postApproved(b.to, text);
    return r.ok ? NextResponse.json({ ok: true, to: PULSE_SLACK_CHANNELS[b.to].name })
      : NextResponse.json({ error: WHY[r.reason] ?? `Slack did not take it (${r.reason}).` }, { status: 502 });
  }
  const sent = await dmAdmin(`:white_check_mark: Test from the ${CO.pulse_name}. Slack DMs from the site are working.`);
  return sent ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Slack did not take it. Check the Vercel logs for Slack's reason." }, { status: 502 });
}
