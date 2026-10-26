import { NextResponse, type NextRequest } from "next/server";
import { getSession, refreshSession } from "@/lib/pulse/auth";
import { record } from "@/lib/pulse/activity";

export const dynamic = "force-dynamic";

// Page views, active minutes and soundtrack plays from the browser. Everything else is logged on the server.
// Every page view also renews the session to 90 days from now, so a device that signed in once stays in.
export async function POST(req: NextRequest) {
  const s = (await getSession());
  if (!s) return new NextResponse(null, { status: 204 });
  (await refreshSession());
  const b = await req.json().catch(() => ({}));
  if (b.kind === "page" && typeof b.path === "string" && b.path.startsWith("/pulse")) await record(s, "page", b.path);
  else if (b.kind === "beat") await record(s, "beat");
  else if (b.kind === "music") await record(s, "music");
  return new NextResponse(null, { status: 204 });
}
