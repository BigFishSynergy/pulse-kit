import "server-only";
import { get, put } from "@vercel/blob";
import type { PulseUser } from "./auth";
import { CO } from "./config";
import { linkUrl, savedLinkFor } from "./links";
import { DM_WORD, dmPerson, PERSONAL, SERVICE, SERVICE_NAME, slackReady, WAY } from "./slack";

// A person's own sign-in link, sent to them and nobody else: a Slack DM from the company's Pulse app, or an email from
// the Pulse's mailbox (messages.service in pulse.config.json). Two ways:
//   - they ask for it themselves: "Send my link" on either sign-in page (app/pulse/actions.ts)
//   - the admin presses Send link on the People page (/pulse/hq/people)
// It goes only to the Slack member ID or email address saved on their login (dm), and it is only their own working link:
// the sealed copy the People page keeps when it makes a link (lib/pulse/links.ts). Google Chat and Teams only post to a
// space, so with those there is no Send. Someone asking for their own link gets one message per 10 minutes at most, so a
// typed name can't flood a person.

export type SendResult = "sent" | "no_dm" | "no_link" | "not_live_site" | "not_set_up" | "too_soon" | "failed";

/** People who can be sent a link: every personal login, not guest or other time-limited links. */
export const sendable = (u: PulseUser) => !u.view && u.u !== "guest" && !u.expires;

/** Whether this Pulse can send people their links: Slack or email, and set up in Vercel. */
export const canSendLinks = () => PERSONAL && slackReady();

const WAIT = 10 * 60_000;
const PREFIX = process.env.VERCEL_ENV === "production" ? "signin-link-sends/" : "signin-link-sends-preview/";
const local = new Map<string, number>();

async function lastSent(u: string): Promise<number> {
  if (!process.env.VERCEL) return local.get(u) ?? 0;
  try {
    const r = await get(`${PREFIX}${u}.json`, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return 0;
    return Date.parse((JSON.parse(await new Response(r.stream).text()) as { at?: string }).at ?? "") || 0;
  } catch {
    return 0;
  }
}

async function markSent(u: string) {
  if (!process.env.VERCEL) return void local.set(u, Date.now());
  try {
    await put(`${PREFIX}${u}.json`, JSON.stringify({ at: new Date().toISOString() }), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  } catch {}
}

export async function sendLink(u: PulseUser, opts: { self?: boolean } = {}): Promise<SendResult> {
  if (!sendable(u)) return "no_link";
  if (!canSendLinks()) return "not_set_up";
  if (!u.dm) return "no_dm";
  const token = await savedLinkFor(u);
  if (!token) return "no_link";
  if (opts.self && Date.now() - (await lastSent(u.u)) < WAIT) return "too_soon";
  const first = u.name.split(" ")[0];
  const text = [
    `*Your ${CO.pulse_name} sign-in link*`,
    `Hi ${first}. Tap this once on your phone and you're signed in for a year:`,
    linkUrl(token),
    `Keep it to yourself. It signs in as you. If you lose it, tap "Send my link" on the Pulse sign-in page and it comes right back ${SERVICE === "email" ? "to this inbox" : "here"}.`,
  ].join("\n");
  const r = await dmPerson(u.dm, text);
  if (!r.ok) return r.reason === "not_live_site" ? "not_live_site" : r.reason === "not_configured" ? "not_set_up" : "failed";
  await markSent(u.u);
  return "sent";
}

const cap = (s: string) => s.replace(/^./, (x) => x.toUpperCase());

/** What the admin sees after pressing Send link. */
export const SEND_MESSAGES: Record<SendResult, (name: string) => string> = {
  sent: (n) => `Sent. ${n} has their link ${WAY}.`,
  no_dm: (n) => `Not sent: add ${n}'s ${DM_WORD} first.`,
  no_link: (n) => `Not sent: no working link is saved for ${n}. Press New link (their old link stops working), then Send link.`,
  not_live_site: () => "Not sent: only the live site sends messages.",
  not_set_up: () => "Not sent: messages aren't set up yet (docs/SETUP.md step 12).",
  too_soon: (n) => `Not sent: ${n} got their link in the last 10 minutes.`,
  failed: () => `${cap(SERVICE_NAME[SERVICE])} didn't take it. Try again in a minute.`,
};

/** The same, short, for a list of names. */
export const WHY: Record<Exclude<SendResult, "sent">, string> = {
  no_dm: `no ${DM_WORD}`, no_link: "no saved link", not_live_site: "only the live site sends", not_set_up: "messages aren't set up",
  too_soon: "sent in the last 10 minutes", failed: `${SERVICE_NAME[SERVICE]} didn't take it`,
};
