import { type NextRequest } from "next/server";
import { getSession } from "@/lib/pulse/auth";
import { readPhoto, SLUG } from "@/lib/pulse/photos";
import { screenFor } from "@/lib/pulse/tv";

export const dynamic = "force-dynamic";

// One team photo, for signed-in people or an office TV (its own link's token in ?tv=). Never public.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG.test(params.slug)) return new Response("Not found", { status: 404 });
  const tv = req.nextUrl.searchParams.get("tv");
  if (!(await getSession()) && !(tv && (await screenFor(tv)))) return new Response("Not allowed", { status: 401 });
  const img = await readPhoto(params.slug);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
