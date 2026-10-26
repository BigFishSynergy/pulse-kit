import "server-only";
import { CONFIG } from "./config";

// The Pulse's messages (the daily posts, new requests, and the admin's notices), sent through whatever the company
// already uses. pulse.config.json messages.service picks one: slack, google_chat, teams, email, or none. Nobody has to
// sign up for anything new; with none, the Pulse simply doesn't send messages.
//
//   slack        PULSE_SLACK_BOT_TOKEN (the app's bot token), PULSE_SLACK_NOTIFY_USER (the admin's member ID),
//                PULSE_SLACK_CHANNELS  (pulse:C0123,leadership:C0456,sales:C0789)
//   google_chat  PULSE_GCHAT_WEBHOOKS  (pulse:https://chat.googleapis.com/...,sales:...,admin:...) one incoming webhook per space
//   teams        PULSE_TEAMS_WEBHOOKS  (pulse:https://...,sales:...,admin:...) one Workflows "when a webhook request is received" per channel
//   email        PULSE_SMTP_URL (their own mailbox's SMTP, e.g. smtps://pulse%40theirco.com:app-password@smtp.gmail.com:465),
//                PULSE_EMAIL_TO (pulse:a@theirco.com;b@theirco.com,sales:...,admin:owner@theirco.com), PULSE_EMAIL_FROM (optional)
// Webhook addresses and SMTP passwords are secrets: Vercel settings only, marked Sensitive.
// "admin" is where the admin's own notices go (Slack: a DM). A channel gets only what the admin approved (postApproved): their
// own words from the Post a message page, the daily messages, or each new Pulse request, word for word (phones and emails
// masked). Only the live site sends: previews and local development send nothing. Messages carry no customer names,
// phones, emails or addresses (jobs by job number only).
// One more kind of message goes to one person only: their own sign-in link, to the Slack member ID or email address on
// their login, when they ask for it on a sign-in page or the admin presses Send link on the People page (sendlink.ts).

export type Service = "slack" | "google_chat" | "teams" | "email" | "none";
export const SERVICE: Service = ((CONFIG.slack as { service?: Service }).service ?? "slack") as Service;
export const SERVICE_NAME: Record<Service, string> = { slack: "Slack", google_chat: "Google Chat", teams: "Microsoft Teams", email: "email", none: "messages" };

const pairs = (v?: string): Record<string, string> =>
  Object.fromEntries((v ?? "").split(",").map((x) => { const i = x.indexOf(":"); return i > 0 ? [x.slice(0, i).trim(), x.slice(i + 1).trim()] : ["", ""]; }).filter(([k, v]) => k && v));
const WHERE: Record<string, string> = SERVICE === "slack" ? pairs(process.env.PULSE_SLACK_CHANNELS)
  : SERVICE === "google_chat" ? pairs(process.env.PULSE_GCHAT_WEBHOOKS)
  : SERVICE === "teams" ? pairs(process.env.PULSE_TEAMS_WEBHOOKS)
  : SERVICE === "email" ? pairs(process.env.PULSE_EMAIL_TO) : {};

type Ch = { id: string; name: string; who: string };
/** The places the Pulse posts to: names from pulse.config.json, addresses from the service's Vercel setting. */
export const PULSE_SLACK_CHANNELS: Record<string, Ch> = Object.fromEntries(
  Object.entries(CONFIG.slack.channels ?? {}).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, { id: WHERE[k] ?? "", name: v.name, who: v.who }]),
);
export type PulseSlackChannel = string;
export const isPulseSlackChannel = (v: unknown): v is PulseSlackChannel => typeof v === "string" && v in PULSE_SLACK_CHANNELS;

const adminTarget = () => (SERVICE === "slack" ? process.env.PULSE_SLACK_NOTIFY_USER ?? "" : WHERE.admin ?? "");
export const slackReady = () =>
  SERVICE === "slack" ? !!(process.env.PULSE_SLACK_BOT_TOKEN && process.env.PULSE_SLACK_NOTIFY_USER)
  : SERVICE === "email" ? !!(process.env.PULSE_SMTP_URL && Object.keys(WHERE).length)
  : SERVICE === "none" ? false : Object.keys(WHERE).length > 0;

type Sent = { ok: true } | { ok: false; reason: string };
/** Slack Block Kit blocks (header, section, fields, context). Other services get the same message as plain lines. */
export type SlackBlock = Record<string, unknown>;

// ---------- the same message for every service ----------

const EMOJI: Record<string, string> = { bulb: "💡", bar_chart: "📊", warning: "⚠️", white_check_mark: "✅", clipboard: "📋", fire: "🔥", tada: "🎉", trophy: "🏆", rocket: "🚀" };
const emoji = (t: string) => t.replace(/:([a-z_]+):/g, (m, k) => EMOJI[k] ?? m);
/** Block Kit blocks to plain lines in Slack's own markup (*bold*, <url|label>). */
function lines(text: string, blocks?: SlackBlock[]): string[] {
  if (!blocks?.length) return text.split("\n");
  const out: string[] = [];
  for (const b of blocks as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (b.type === "header") out.push(`*${b.text?.text ?? ""}*`);
    else if (b.type === "section" && b.text) out.push(b.text.text);
    else if (b.type === "section" && b.fields) out.push(b.fields.map((f: { text: string }) => f.text.replace(/\n/g, " ")).join("   "));
    else if (b.type === "context") out.push((b.elements ?? []).map((e: { text?: string }) => e.text ?? "").join(" "));
    else if (b.type === "divider") out.push("");
  }
  return out.join("\n").split("\n");
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toMarkdown = (l: string) => emoji(l).replace(/<([^|>]+)\|([^>]+)>/g, "[$2]($1)").replace(/(^|\s)\*([^*\n]+)\*/g, "$1**$2**");
const toHtml = (l: string) => {
  const parts: string[] = [];
  let rest = emoji(l), m: RegExpExecArray | null;
  const rx = /<([^|>]+)\|([^>]+)>/g;
  let last = 0;
  while ((m = rx.exec(rest))) { parts.push(esc(rest.slice(last, m.index)), `<a href="${esc(m[1])}">${esc(m[2])}</a>`); last = rx.lastIndex; }
  parts.push(esc(rest.slice(last)));
  rest = parts.join("");
  return rest.replace(/(^|\s)\*([^*\n]+)\*/g, "$1<b>$2</b>");
};

async function post(url: string, body: unknown): Promise<Sent> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    return r.ok ? { ok: true } : { ok: false, reason: `HTTP ${r.status}` };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

async function send(target: string, text: string, blocks?: SlackBlock[]): Promise<Sent> {
  if (!target || SERVICE === "none") return { ok: false, reason: "not_configured" };
  if (process.env.VERCEL_ENV !== "production") return { ok: false, reason: "not_live_site" };
  const L = lines(text, blocks);
  if (SERVICE === "google_chat") return post(target, { text: L.map(emoji).join("\n") }); // Google Chat reads *bold* and <url|label> as is
  if (SERVICE === "teams") {
    return post(target, { type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4",
      body: L.filter((l, i) => l || L[i - 1]).map((l, i) => ({ type: "TextBlock", wrap: true, text: toMarkdown(l) || " ", ...(i === 0 ? { weight: "Bolder", size: "Medium" } : {}) })) } }] });
  }
  if (SERVICE === "email") {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const t = nodemailer.createTransport(process.env.PULSE_SMTP_URL!);
      const from = process.env.PULSE_EMAIL_FROM || (t.options as { auth?: { user?: string } }).auth?.user;
      const subject = emoji(L[0] ?? text).replace(/\*/g, "").slice(0, 120);
      await t.sendMail({ from, to: target.split(";").map((x) => x.trim()).filter(Boolean), subject,
        text: L.map((l) => emoji(l).replace(/<([^|>]+)\|([^>]+)>/g, "$2 ($1)").replace(/\*/g, "")).join("\n"),
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${L.map((l) => (l ? `<p style="margin:0 0 8px">${toHtml(l)}</p>` : "<hr>")).join("")}</div>` });
      return { ok: true };
    } catch (e) {
      console.error("Pulse email not sent:", (e as Error).message);
      return { ok: false, reason: "email_failed" };
    }
  }
  const token = process.env.PULSE_SLACK_BOT_TOKEN;
  if (!token) return { ok: false, reason: "not_configured" };
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: target, text, ...(blocks?.length ? { blocks } : {}), unfurl_links: false, unfurl_media: false }),
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

/** Whether Slack accepts the app's token (auth.test sends nothing). Slack on the live site only; null when it cannot be checked. */
export async function slackConnected(): Promise<boolean | null> {
  const token = process.env.PULSE_SLACK_BOT_TOKEN;
  if (SERVICE !== "slack" || !token || process.env.VERCEL_ENV !== "production") return null;
  try {
    const r = await fetch("https://slack.com/api/auth.test", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    return (await r.json().catch(() => ({}))).ok === true;
  } catch {
    return null;
  }
}

/** Send the admin a notice (Slack: a DM; others: the "admin" place). Returns true if it was taken. Never throws. */
export async function dmAdmin(text: string, blocks?: SlackBlock[]): Promise<boolean> {
  return (await send(adminTarget(), text, blocks)).ok;
}

/** Post to a place. Only for what the admin approved: their own words on the Post a message page, the daily messages, or new Pulse requests. */
export const postApproved = (to: PulseSlackChannel, text: string, blocks?: SlackBlock[]) => send(PULSE_SLACK_CHANNELS[to]?.id ?? "", text, blocks);

// ---------- one person's own sign-in link ----------

/** Services that can reach one person: Slack (a DM to their member ID) and email (their own address). Google Chat and
 * Teams webhooks only post to a space, so with those the Pulse can't send anyone their link. */
export const PERSONAL = SERVICE === "slack" || SERVICE === "email";
/** "in Slack" or "by email", for the Send my link buttons, and where to look for it. */
export const WAY = SERVICE === "email" ? "by email" : "in Slack";
export const INBOX = SERVICE === "email" ? "in your email" : "in Slack";
/** What the People page asks for to reach someone (PulseUser.dm). */
export const DM_LABEL = SERVICE === "email" ? "Email" : "Slack member ID";
export const DM_WORD = SERVICE === "email" ? "email address" : "Slack member ID";

/** A tidy Slack member ID or email address, "" for blank, or null when it isn't one. One address, never a list. */
export function cleanDm(v: string): string | null {
  const t = v.trim();
  if (!t) return "";
  if (SERVICE === "email") return /^[^\s@;,<>]+@[^\s@;,<>]+\.[a-z]{2,}$/i.test(t) ? t.toLowerCase() : null;
  return /^[UW][A-Z0-9]{6,15}$/.test(t.toUpperCase()) ? t.toUpperCase() : null;
}

/** Send one person a message of their own. Only ever their own sign-in link (lib/pulse/sendlink.ts). */
export const dmPerson = (to: string, text: string) => send(to, text);
