import { NextResponse, type NextRequest } from "next/server";
import { head } from "@vercel/blob";
import { getSession } from "@/lib/pulse/auth";
import { pageOn } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// Streams one song from the private store to a signed-in person, in pieces of up to 1 MB, the way browsers
// (iPhones especially) like to fetch audio. There is no public link to the files.
const CHUNK = 1024 * 1024;
const where = new Map<string, { url: string; size: number }>();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!pageOn("soundtrack")) return new Response("Not found", { status: 404 });
  if (!getSession()) return new NextResponse("Not allowed", { status: 401 });
  if (!/^[a-z0-9-]{1,60}$/.test(params.id)) return new NextResponse("Not found", { status: 404 });
  let meta = where.get(params.id);
  if (!meta) {
    try {
      const h = await head(`music/${params.id}.mp3`);
      meta = { url: h.url, size: h.size };
      where.set(params.id, meta);
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : start + CHUNK - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, meta.size - Number(m[2])); end = meta.size - 1; } // suffix range
  end = Math.min(end, start + CHUNK - 1, meta.size - 1);
  if (start >= meta.size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${meta.size}` } });
  const r = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`, Range: `bytes=${start}-${end}` } });
  if (!r.ok || !r.body) return new NextResponse("Unavailable", { status: 502 });
  return new NextResponse(r.body, {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${meta.size}`,
      "Content-Length": String(end - start + 1),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
