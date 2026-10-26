import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { headers } from "next/headers";
import { get, put } from "@vercel/blob";
import { linkOnDevice, openLink, type Session } from "./auth";
import { CO } from "./config";

// Each person's own sign-in link, kept sealed (lib/pulse/auth.ts) from the last time they tapped it, so "My sign-in link"
// in the header menu works on their other phones and computers too, including one signed in with a name and password.
//   production          Blob  signin-links/<username>.json
//   Vercel previews     Blob  signin-links-preview/...   (a preview never touches the real copies)
//   local development   site/pipeline/.cache/signin-links (git-ignored)
// Only the sealed link is stored. Nobody can read it without PULSE_SESSION_SECRET, and it is only shown to its owner.

const useBlob = () => !!process.env.VERCEL;
const PREFIX = process.env.VERCEL_ENV === "production" ? "signin-links/" : "signin-links-preview/";
const LOCAL = path.join(process.cwd(), "pipeline", ".cache", "signin-links");
const NAME = /^[a-z0-9._-]{1,40}$/i;

/** Keep the sealed link as this person's copy. Never throws: signing in must not depend on it. */
export async function keepLinkCopy(u: string, sealed: string) {
  if (!NAME.test(u)) return;
  const body = JSON.stringify({ sealed, at: new Date().toISOString() });
  try {
    if (useBlob()) await put(`${PREFIX}${u}.json`, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
    else { await fs.mkdir(LOCAL, { recursive: true }); await fs.writeFile(path.join(LOCAL, `${u}.json`), body); }
  } catch {
    console.error("Sign-in link copy not saved");
  }
}

async function linkCopy(u: string): Promise<string | null> {
  if (!NAME.test(u)) return null;
  try {
    if (useBlob()) {
      const r = await get(`${PREFIX}${u}.json`, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return (JSON.parse(await new Response(r.stream).text()) as { sealed?: string }).sealed ?? null;
    }
    return (JSON.parse(await fs.readFile(path.join(LOCAL, `${u}.json`), "utf8")) as { sealed?: string }).sealed ?? null;
  } catch {
    return null;
  }
}

/** The signed-in person's own working link token: this device's first, then their saved copy. Null if neither works. */
export async function myLinkToken(s: Session): Promise<string | null> {
  return linkOnDevice(s) ?? openLink(await linkCopy(s.u), s);
}

/** The site's address: pulse.config.json company.site_url live (the address users.mjs prints), the visitor's own when testing. */
export function siteOrigin(): string {
  if (process.env.VERCEL_ENV === "production") return CO.site_url.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export const linkUrl = (token: string) => `${siteOrigin()}/pulse/k/${token}`;
