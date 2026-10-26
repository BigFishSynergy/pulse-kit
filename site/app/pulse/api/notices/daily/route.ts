import { NextResponse, type NextRequest } from "next/server";
import { buildDaily, DAILY, easternNow, markSent, readSettings, sentOn, writeSettings } from "@/lib/pulse/daily";
import { postApproved } from "@/lib/pulse/slack";
import { pageOn } from "@/lib/pulse/config";

// Hourly (Vercel cron, see vercel.json). If today's daily message is switched on and this is its hour in the
// company's time zone, build it from the latest Pulse data and post it, once. Working in local time here keeps the times
// right when the clocks change. Days that are off, or already posted today, are skipped.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!pageOn("slack")) return new Response("Not found", { status: 404 });
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Not allowed", { status: 401 });
  const now = easternNow();
  const day = DAILY.find((d) => d.dow === now.dow);
  if (!day || now.hour !== day.hour) return NextResponse.json({ ok: true, waiting: day ? `${day.title} posts at ${day.time}` : "no message today" });
  const settings = await readSettings();
  if (!settings[day.key].on) return NextResponse.json({ ok: true, day: day.key, off: true });
  if (await sentOn(now.date)) return NextResponse.json({ ok: true, day: day.key, already: true });
  try {
    const msg = await buildDaily(day.key);
    const results = await Promise.all(day.to.map(async (to) => ({ to, ...(await postApproved(to, msg.text, msg.blocks)) })));
    if (!results.some((r) => r.ok)) return NextResponse.json({ ok: false, day: day.key, results }, { status: 502 });
    await markSent(now.date, day.key);
    settings[day.key].lastPosted = new Date().toISOString();
    await writeSettings(settings);
    return NextResponse.json({ ok: true, day: day.key, posted: results.map((r) => ({ to: r.to, ok: r.ok })) });
  } catch (e) {
    console.error("Daily Pulse message not built:", (e as Error).message);
    return NextResponse.json({ ok: false, day: day.key, reason: (e as Error).message }, { status: 500 });
  }
}
