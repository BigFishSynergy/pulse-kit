import { NextResponse, type NextRequest } from "next/server";
import { get, head, put } from "@vercel/blob";
import { dmAdmin } from "@/lib/pulse/slack";
import { TZ } from "@/lib/pulse/config";

// Hourly (Vercel cron, see vercel.json), 13 minutes after the data job. Two DMs to the admin, each sent once:
//   Fallback  the newest rules broke the build, so the data job built with the last rules that worked
//             (meta.rules_fallback). The numbers are current; the build needs updating for the rules change.
//   Stale     the numbers have not been rebuilt for 4 hours during the workday (8 AM to 8 PM local time), whatever the
//             reason. Once a day at most.
// Markers in notices/ stop repeats. The DMs say what happened and link to the job: never any data.
export const dynamic = "force-dynamic";

const STALE_MS = 4 * 3600e3;
const ACTIONS = process.env.VERCEL_GIT_REPO_SLUG ? `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}/actions/workflows/pulse-data.yml` : "the pulse-data workflow in GitHub Actions";

type Meta = { generated_at?: string; pulled_at?: string; rules_commit?: string; rules_fallback?: { newest: string; using: string } };

async function readJson<T>(path: string): Promise<T | null> {
  const r = await get(path, { access: "private", useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text()) as T;
}

async function once(mark: string, text: string): Promise<"sent" | "already" | "failed"> {
  if (await head(mark).catch(() => null)) return "already";
  if (!(await dmAdmin(text))) return "failed"; // try again next hour
  await put(mark, JSON.stringify({ at: new Date().toISOString() }), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  return "sent";
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Not allowed", { status: 401 });
  const meta = await readJson<Meta>("latest/meta.json");
  if (!meta) return NextResponse.json({ ok: true, waiting: "no data yet" });
  const out: Record<string, string> = {};

  const fb = meta.rules_fallback;
  if (fb?.newest && /^[0-9a-f]{6,40}$/.test(fb.newest)) {
    out.fallback = await once(
      `notices/build-fallback-${fb.newest}.json`,
      `:warning: The rules changed and the Pulse build could not use the new version (${fb.newest}). The Pulse is still updating, on the previous rules (${fb.using}). Ask Claude to update the Pulse for the change. Details: ${ACTIONS}`,
    );
  }

  const age = meta.generated_at ? Date.now() - new Date(meta.generated_at).getTime() : NaN;
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  if (age > STALE_MS && et.getHours() >= 8 && et.getHours() < 20) {
    const day = `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
    out.stale = await once(
      `notices/build-stale-${day}.json`,
      `:hourglass: The Pulse numbers have not updated in ${Math.floor(age / 3600e3)} hours (last data: ${meta.pulled_at ?? "unknown"}). The data job is failing. Ask Claude to look. Details: ${ACTIONS}`,
    );
  }
  return NextResponse.json({ ok: true, ...out });
}
