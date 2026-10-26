import { NextResponse } from "next/server";
import { getSession } from "@/lib/pulse/auth";
import { linkUrl, myLinkToken } from "@/lib/pulse/links";

export const dynamic = "force-dynamic";

// "My sign-in link" in the header menu. Only ever the signed-in person's own link, and only while it still works.
// Asked for when the menu item is opened, so links never sit in a page's HTML.
export async function GET() {
  const s = (await getSession());
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const token = await myLinkToken(s);
  return NextResponse.json({ url: token ? linkUrl(token) : null }, { headers: { "Cache-Control": "private, no-store" } });
}
