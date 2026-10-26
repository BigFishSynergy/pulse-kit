import "server-only";
import { CONFIG } from "./config";

// The company's Slack: one app (named for the Pulse) in the company's own workspace (chat:write, im:write, files:write).
//   PULSE_SLACK_BOT_TOKEN    the app's bot token (Vercel, Production, Sensitive)
//   PULSE_SLACK_NOTIFY_USER  the admin's member ID in the workspace (pulse.config.json people.admin)
//   PULSE_SLACK_CHANNELS     channel IDs by key, e.g. pulse:C0123,leadership:C0456,sales:C0789 (names in pulse.config.json)
// Automatic notices only ever DM the admin (dmAdmin). A channel gets only what the admin approved (postApproved): their
// own words from the Post to Slack page (/pulse/hq/slack), the daily messages (lib/pulse/daily.ts), which post on their
// own unless switched off there, or each new Pulse request, word for word (phone numbers and emails masked).
// Only the live site sends: previews and local development send nothing. The token stays in this file: it never goes
// to a browser, a log, an error message or the repo. Messages carry no customer names, phones, emails or addresses
// (jobs by job number only) and, for automatic notices other than requests, nothing someone typed: who did what, and a link.

const IDS: Record<string, string> = Object.fromEntries(
  (process.env.PULSE_SLACK_CHANNELS ?? "").split(",").map((x) => x.split(":").map((y) => y.trim())).filter((x) => x.length === 2 && x[0] && x[1]),
);
type Ch = { id: string; name: string; who: string };
/** Channels the app has been added to: names from pulse.config.json, IDs from PULSE_SLACK_CHANNELS. */
export const PULSE_SLACK_CHANNELS: Record<string, Ch> = Object.fromEntries(
  Object.entries(CONFIG.slack.channels ?? {}).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, { id: IDS[k] ?? "", name: v.name, who: v.who }]),
);
export type PulseSlackChannel = string;
export const isPulseSlackChannel = (v: unknown): v is PulseSlackChannel => typeof v === "string" && v in PULSE_SLACK_CHANNELS;

export const slackReady = () => !!(process.env.PULSE_SLACK_BOT_TOKEN && process.env.PULSE_SLACK_NOTIFY_USER);

type Sent = { ok: true } | { ok: false; reason: string };
/** Slack Block Kit blocks (header, section, divider, context). `text` is always sent too, for notifications. */
export type SlackBlock = Record<string, unknown>;

async function send(channel: string, text: string, blocks?: SlackBlock[]): Promise<Sent> {
  const token = process.env.PULSE_SLACK_BOT_TOKEN;
  if (!token || !channel) return { ok: false, reason: "not_configured" };
  if (process.env.VERCEL_ENV !== "production") return { ok: false, reason: "not_live_site" };
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel, text, ...(blocks?.length ? { blocks } : {}), unfurl_links: false, unfurl_media: false }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok === true) return { ok: true };
    const reason = typeof j.error === "string" ? j.error : `HTTP ${r.status}`;
    console.error("Slack message not sent:", reason);
    return { ok: false, reason };
  } catch {
    console.error("Slack message not sent: network error");
    return { ok: false, reason: "network_error" };
  }
}

/** Whether Slack accepts the app's token (auth.test sends nothing). Live site only; null when it cannot be checked. */
export async function slackConnected(): Promise<boolean | null> {
  const token = process.env.PULSE_SLACK_BOT_TOKEN;
  if (!token || process.env.VERCEL_ENV !== "production") return null;
  try {
    const r = await fetch("https://slack.com/api/auth.test", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    return (await r.json().catch(() => ({}))).ok === true;
  } catch {
    return null;
  }
}

/** Send the admin a Slack DM. Returns true if Slack took it. Never throws. */
export async function dmAdmin(text: string, blocks?: SlackBlock[]): Promise<boolean> {
  return (await send(process.env.PULSE_SLACK_NOTIFY_USER ?? "", text, blocks)).ok;
}

/** Post to a channel. Only for what the admin approved: their own words on the Post to Slack page, the daily messages, or new Pulse requests. */
export const postApproved = (to: PulseSlackChannel, text: string, blocks?: SlackBlock[]) => send(PULSE_SLACK_CHANNELS[to]?.id ?? "", text, blocks);
