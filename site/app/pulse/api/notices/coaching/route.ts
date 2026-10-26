import { NextResponse, type NextRequest } from "next/server";
import { get, head, put } from "@vercel/blob";
import { dmAdmin } from "@/lib/pulse/slack";
import { CO } from "@/lib/pulse/config";

// Hourly (Vercel cron, see vercel.json): when this week's coaching cards and priorities land (coach.py writes
// coaching/<week_start>.json on Monday mornings), DM the admin once. A marker in notices/ stops repeats. Cards that
// arrived more than 6 hours ago are marked without a DM, so a deploy or a missed run never sends a stale notice.
// The DM says only that they are ready, with counts and the link: nothing from inside the cards.
export const dynamic = "force-dynamic";

const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const FRESH_MS = 6 * 3600e3;

async function readJson<T>(path: string): Promise<T | null> {
  const r = await get(path, { access: "private", useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text()) as T;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Not allowed", { status: 401 });
  const week = (await readJson<{ week_start?: string }>("latest/meta.json"))?.week_start ?? "";
  if (!WEEK.test(week)) return NextResponse.json({ ok: true, waiting: "no data week yet" });
  const mark = `notices/coaching-${week}.json`;
  if (await head(mark).catch(() => null)) return NextResponse.json({ ok: true, week, already: true });
  const file = await head(`coaching/${week}.json`).catch(() => null);
  if (!file) return NextResponse.json({ ok: true, week, waiting: "cards not written yet" });
  const fresh = Date.now() - new Date(file.uploadedAt).getTime() < FRESH_MS;
  let sent = false;
  if (fresh) {
    const c = await readJson<{ team?: unknown[]; priorities?: unknown[] }>(`coaching/${week}.json`);
    const label = new Date(`${week}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    sent = await dmAdmin(
      `:clipboard: This week's coaching cards and priorities are ready (data week of ${label}): ${c?.team?.length ?? 0} cards, ${c?.priorities?.length ?? 0} priorities. See them: ${CO.site_url.replace(/\/$/, "")}/pulse/hq/pulse`,
    );
    // If Slack did not take it, try again next hour while the cards are still fresh.
    if (!sent) return NextResponse.json({ ok: true, week, sent: false });
  }
  await put(mark, JSON.stringify({ at: new Date().toISOString(), sent }), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  return NextResponse.json({ ok: true, week, sent, stale: !fresh });
}
