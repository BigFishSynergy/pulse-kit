import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { adminFirst, CONFIG } from "./config";
import { allUsers } from "./userstore";

// Pulse logins. Three roles that never mix:
//   rep   one sales rep, sees only their own screen plus the team leaderboard tops
//   csr   one CSR (appointment setter), sees only their own CSR screen plus the sales team's tops and totals
//   lead  the leadership team: the full Pulse
// Logins live in the company's private Blob store (lib/pulse/userstore.ts), managed by the admin on the People page
// (/pulse/hq/people); the first one is made on /pulse/setup. Passwords are scrypt hashes only. Sessions are HMAC-signed cookies scoped to /pulse: 90 days from the last visit (365 from a
// sign-in link), renewed as people use the site (refreshSession), so a phone or computer that signed in once stays signed in.

export type Role = "rep" | "lead" | "csr";
// rep: the rep's slug. csr: the CSR's slug (their "Appointment Set By" name in the CRM, lower case).
export type PulseUser = { u: string; name: string; role: Role; rep?: string; csr?: string; hash: string; key?: string; expires?: string; view?: boolean; dm?: string };
// expires: a guest link (users.mjs guest) stops working at this time, and its sessions end with it.
// dm: where this person gets their own sign-in link when they ask for it: a Slack member ID, or with email an address.
const expired = (u: PulseUser) => !!u.expires && Date.parse(u.expires) <= Date.now();
// view: a view-only login (every guest link). Sees everything leadership sees, changes nothing: no request statuses,
// no suggestions, no Ask Claude, no graphics, no Slack posts, no Speed Round. The API routes enforce it, not just the buttons.
export type Session = { u: string; name: string; role: Role; rep?: string; csr?: string; view?: boolean };
export const VIEW_ONLY = `View-only guest access. Ask ${adminFirst()} if you need more.`;

const COOKIE = "pulse_session";
const PATH = "/pulse";
// 90 days for every role, renewed on each visit.
const KEEP_DAYS = 90;
const DAYS: Record<Role, number> = { rep: KEEP_DAYS, csr: KEEP_DAYS, lead: KEEP_DAYS };
// This device's own sign-in link (sealed), and whose "You're signed in" page this device has already shown.
const LINK = "pulse_link";
const HELLO = "rr_hello";
const YEAR = 365 * 86400;
const cookieBase = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: PATH });

function secret(): string {
  const s = process.env.PULSE_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("PULSE_SESSION_SECRET is missing or too short");
  return s;
}

export const users = (): Promise<PulseUser[]> => allUsers();

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");
// Changing a password or making a new sign-in link changes this, which ends every session signed before the change.
const passwordVersion = (u: PulseUser) => createHash("sha256").update(u.hash + "|" + (u.key ?? "")).digest("base64url").slice(0, 10);
const sha = (t: string) => createHash("sha256").update(t).digest("base64url");

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = scryptSync(password, Buffer.from(salt, "base64url"), want.length, { N: 16384, r: 8, p: 1 });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Check a login on one side of the site. A rep login never works on the leadership page and the other way around.
 * The sales login page (role "rep") also takes CSR logins: both are the sales side. */
export async function checkLogin(username: string, password: string, role: Role): Promise<PulseUser | null> {
  const fits = (r: Role) => r === role || (role === "rep" && r === "csr");
  const u = (await users()).find((x) => x.u.toLowerCase() === username.trim().toLowerCase() && fits(x.role));
  // Run scrypt even for unknown names so timing does not reveal who has an account.
  const ok = verifyPassword(password, u?.hash ?? "scrypt:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  return u && ok ? u : null;
}

/** A personal sign-in link: /pulse/k/<token>. Only the token's hash is stored, in PULSE_USERS. */
export async function checkLink(token: string): Promise<PulseUser | null> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const h = sha(token);
  const u = (await users()).find((x) => x.key && x.key.length === h.length && timingSafeEqual(Buffer.from(x.key), Buffer.from(h)));
  return u && !expired(u) ? u : null;
}

export function startSession(u: PulseUser, days = DAYS[u.role]) {
  if (u.expires) days = Math.min(days, Math.max(0, (Date.parse(u.expires) - Date.now()) / 864e5));
  writeSession(u, Date.now() + days * 864e5);
}

function writeSession(u: PulseUser, exp: number) {
  const body = b64(JSON.stringify({ u: u.u, r: u.role, v: passwordVersion(u), exp }));
  cookies().set(COOKIE, `${body}.${sign(body)}`, { ...cookieBase(), maxAge: Math.max(0, Math.floor((exp - Date.now()) / 1000)) });
}

/** Push a signed-in session out to 90 days from now. Never shortens one (a sign-in link gives a year), never runs past a
 * guest link's end, and rewrites the cookie at most about once a day. Route handlers only (pages cannot set cookies). */
export async function refreshSession() {
  const s = await readSession();
  if (!s) return;
  let exp = Date.now() + KEEP_DAYS * 864e5;
  if (s.user.expires) exp = Math.min(exp, Date.parse(s.user.expires));
  if (exp - s.exp > 864e5) writeSession(s.user, exp);
}

export function endSession() {
  cookies().set(COOKIE, "", { httpOnly: true, path: PATH, maxAge: 0 });
  cookies().set(LINK, "", { httpOnly: true, path: PATH, maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const s = await readSession();
  if (!s) return null;
  const u = s.user;
  return { u: u.u, name: u.name, role: u.role, rep: u.rep, csr: u.csr, view: !!u.view || u.u === "guest" };
}

async function readSession(): Promise<{ user: PulseUser; exp: number } | null> {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let p: { u: string; r: Role; v: string; exp: number };
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!p.exp || p.exp < Date.now()) return null;
  // The user must still exist, with the same role and password, for the session to count.
  const u = (await users()).find((x) => x.u === p.u && x.role === p.r);
  if (!u || passwordVersion(u) !== p.v || expired(u)) return null;
  return { user: u, exp: p.exp };
}

/* Personal sign-in links, shown back to their owner. PULSE_USERS keeps only each link's hash, so the site cannot rebuild a
 * link. Instead, when someone taps theirs, the site keeps it sealed (AES-GCM, with a key made from PULSE_SESSION_SECRET):
 * in a cookie on that device, and as a copy in storage (lib/pulse/links.ts) for their other devices. A sealed link is only
 * ever shown to the person it signs in, and only while it still works. */
const sealKey = () => createHmac("sha256", secret()).update("pulse-signin-link-v1").digest();

export function sealLink(token: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([c.update(token, "utf8"), c.final()]);
  return b64(Buffer.concat([iv, c.getAuthTag(), body]));
}

/** The link token inside a sealed copy, if it is still a working link for this person. */
export async function openLink(sealed: string | null | undefined, s: Session): Promise<string | null> {
  if (!sealed) return null;
  let token: string;
  try {
    const b = Buffer.from(sealed, "base64url");
    if (b.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", sealKey(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    token = Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
  const u = await checkLink(token);
  return u && u.u === s.u && u.role === s.role ? token : null;
}

/** After a sign-in link: keep it sealed on this device, for the "You're signed in" page and the header menu. */
export function keepLinkOnDevice(sealed: string) {
  cookies().set(LINK, sealed, { ...cookieBase(), maxAge: YEAR });
}
export const linkOnDevice = (s: Session): Promise<string | null> => openLink(cookies().get(LINK)?.value, s);

/** The "You're signed in" page shows once per person on each device. True the first time; marks it shown. */
export function firstLinkHere(u: PulseUser): boolean {
  if (cookies().get(HELLO)?.value === u.u) return false;
  cookies().set(HELLO, u.u, { ...cookieBase(), maxAge: YEAR });
  return true;
}

/** Each role's home page. */
export const homeOf = (role: Role) => (role === "lead" ? "/pulse/hq/pulse" : role === "csr" ? "/pulse/csr" : "/pulse/me");

/** Sales side pages. Leadership can open any rep's screen from their own pages instead. */
export async function requireRep(): Promise<Session & { rep: string }> {
  const s = await getSession();
  if (!s) redirect("/pulse");
  if (s.role !== "rep") redirect(homeOf(s.role));
  if (!s.rep) redirect("/pulse");
  return s as Session & { rep: string };
}

/** A CSR's own screen. Reps and leaders go to their own home page. */
export async function requireCsr(): Promise<Session & { csr: string }> {
  const s = await getSession();
  if (!s) redirect("/pulse");
  if (s.role !== "csr") redirect(homeOf(s.role));
  if (!s.csr) redirect("/pulse");
  return s as Session & { csr: string };
}

/** Sales side pages everyone on the sales side shares (the Speed Round): reps and CSRs. */
export async function requireSalesSide(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/pulse");
  if (s.role === "lead") redirect("/pulse/hq/pulse");
  return s;
}

/** Leadership pages where people make changes or see the team's own activity. A view-only guest goes back to the Pulse. */
export async function requireLeadEditor(): Promise<Session> {
  const s = await requireLead();
  if (s.view) redirect("/pulse/hq/pulse");
  return s;
}

/** Leadership pages. A rep who guesses the address gets a plain 404, nothing that hints a page is there. */
export async function requireLead(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/pulse/hq");
  if (s.role !== "lead") notFound();
  return s;
}

/** Where to send a leader after signing in, if the sign-in started from a leadership page link. Only leadership paths. */
export function safeNext(n: unknown): string | null {
  const s = typeof n === "string" ? n : "";
  return /^\/pulse\/hq\/[a-z0-9/-]{1,80}$/.test(s) && !s.includes("//") ? s : null;
}

/** The admin login (pulse.config.json people.admin): the only one who can post to Slack from the Pulse. */
export const isAdmin = (s: Session | null): boolean => !!s && s.role === "lead" && !s.view && s.u === CONFIG.people.admin;
