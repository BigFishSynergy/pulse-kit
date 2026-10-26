import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getSession } from "@/lib/pulse/auth";
import { pageOn } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// The soundtrack list, for signed-in people only.
export async function GET() {
  if (!pageOn("soundtrack")) return new Response("Not found", { status: 404 });
  if (!(await getSession())) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  try {
    const r = await get("music/index.json", { access: "private" });
    if (!r || r.statusCode !== 200) return NextResponse.json({ tracks: [] });
    const list = JSON.parse(await new Response(r.stream).text()) as { id: string; title: string; artist: string }[];
    return NextResponse.json({ tracks: list.map(({ id, title, artist }) => ({ id, title, artist })) }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}
