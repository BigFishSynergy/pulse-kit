import { NextResponse, type NextRequest } from "next/server";
import { checkLink, firstLinkHere, homeOf, keepLinkOnDevice, sealLink, startSession } from "@/lib/pulse/auth";
import { record } from "@/lib/pulse/activity";
import { keepLinkCopy } from "@/lib/pulse/links";
import { OG } from "@/lib/pulse/og";
import { CO } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// iMessage, Slack, WhatsApp and the like fetch a link to draw its preview. They get the preview card,
// are never signed in, and never show up as a sign-in on the Activity page.
const PREVIEW_BOT = /facebookexternalhit|facebot|twitterbot|slackbot|whatsapp|telegrambot|discordbot|linkedinbot|skypeuripreview|embedly|pinterest|redditbot|bingpreview|googlebot|applebot|vkshare|iframely|outbrain|quora link preview|microsoftpreview|teams/i;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function preview(url: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(OG.title)}</title>
<meta name="robots" content="noindex, nofollow"><meta property="og:type" content="website"><meta property="og:site_name" content="${esc(CO.name)}">
<meta property="og:title" content="${esc(OG.title)}"><meta property="og:description" content="${esc(OG.description)}">
<meta property="og:image" content="${OG.image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(OG.title)}"><meta name="twitter:description" content="${esc(OG.description)}"><meta name="twitter:image" content="${OG.image}">
</head><body style="background:#0A0A0A;color:#fff;font-family:Arial,sans-serif;padding:24px"><p><a style="color:#39FF14" href="${esc(url)}">Open the ${esc(CO.pulse_name)}</a></p></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// Personal sign-in links: tap once, and this phone or computer stays signed in for a year.
// People used to save or share the page the link forwarded to, which has no key in it. So the first time a link is used on a
// device, it lands on "You're signed in" (/pulse/signed-in), which shows the link itself with a Copy button. After that,
// on that device, the link goes straight to the person's home page. The link is also kept sealed for "My sign-in link".
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  if (!req.nextUrl.searchParams.has("go") && PREVIEW_BOT.test(req.headers.get("user-agent") ?? "")) {
    const go = new URL(req.url); go.searchParams.set("go", "1");
    return preview(go.toString());
  }
  const u = await checkLink(params.token);
  if (!u) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.redirect(new URL("/pulse?link=old", req.url), 303);
  }
  startSession(u, 365);
  const sealed = sealLink(params.token);
  keepLinkOnDevice(sealed);
  await Promise.all([keepLinkCopy(u.u, sealed), record({ u: u.u, name: u.name, role: u.role, rep: u.rep }, "signin")]);
  const next = firstLinkHere(u) ? "/pulse/signed-in" : `${homeOf(u.role)}?welcome=1`;
  return NextResponse.redirect(new URL(next, req.url), 303);
}
