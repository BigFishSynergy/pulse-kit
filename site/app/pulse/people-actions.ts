"use server";
import { createHash, randomBytes, scryptSync } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, homeOf, isAdmin, sealLink, startSession, users, type PulseUser, type Role } from "@/lib/pulse/auth";
import { CONFIG } from "@/lib/pulse/config";
import { keepLinkCopy, linkUrl } from "@/lib/pulse/links";
import { saveUsers, storedUsers } from "@/lib/pulse/userstore";

// Managing logins from the site, so nobody needs a terminal: the first login on /pulse/setup, then the People page
// (/pulse/hq/people, the admin only). Passwords and sign-in links are shown once, right here, and stored only as hashes.

export type PeopleState = { error?: string; done?: string; password?: string; link?: string; who?: string };

const hash = (pw: string) => {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("base64url")}:${scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString("base64url")}`;
};
const newPassword = () => randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
const NAME = /^[a-z0-9._-]{2,30}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;

async function requireAdmin() {
  const s = await getSession();
  if (!isAdmin(s)) throw new Error("Only the Pulse admin can change logins.");
  return s!;
}

/** Saved logins with an env login copied in when it is changed here, so the change wins over the env copy. */
async function editable(u: string): Promise<{ list: PulseUser[]; me: PulseUser | undefined }> {
  const list = await storedUsers();
  let me = list.find((x) => x.u === u);
  if (!me) {
    const env = (await users()).find((x) => x.u === u);
    if (env) { me = { ...env }; list.push(me); }
  }
  return { list, me };
}

function makeLink(u: PulseUser) {
  const token = randomBytes(24).toString("base64url");
  u.key = createHash("sha256").update(token).digest("base64url");
  return token;
}

/** The very first login: the admin's, on /pulse/setup. Needs the setup code (Vercel setting PULSE_SETUP_CODE) and works
 * only while there are no logins at all. */
export async function setupFirst(_: PeopleState, form: FormData): Promise<PeopleState> {
  if ((await users()).length) return { error: "The Pulse already has logins. Sign in instead." };
  const code = process.env.PULSE_SETUP_CODE || "";
  if (code.length < 8 || String(form.get("code") || "") !== code) {
    await new Promise((r) => setTimeout(r, 800));
    return { error: "That setup code does not match the PULSE_SETUP_CODE setting in Vercel." };
  }
  const name = String(form.get("name") || "").trim();
  const pw = String(form.get("password") || "");
  if (name.length < 2) return { error: "Type your full name." };
  if (pw.length < 10) return { error: "Pick a password of at least 10 characters." };
  const u: PulseUser = { u: CONFIG.people.admin, name, role: "lead", hash: hash(pw) };
  await saveUsers([u]);
  startSession(u);
  redirect("/pulse/hq/people?welcome=1");
}

export async function addLogin(_: PeopleState, form: FormData): Promise<PeopleState> {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const u = String(form.get("u") || "").trim().toLowerCase();
  const name = String(form.get("name") || "").trim();
  const role = String(form.get("role") || "") as Role;
  const slug = String(form.get("slug") || "").trim();
  if (!NAME.test(u)) return { error: "The login name is 2 to 30 letters or numbers, lower case, no spaces (for example alex)." };
  if (name.length < 2) return { error: "Type the person's full name, the way it shows on screen." };
  if (!["lead", "rep", "csr"].includes(role)) return { error: "Pick a role." };
  if (role !== "lead" && !SLUG.test(slug)) return { error: role === "rep" ? "Pick which rep's numbers they see." : "Pick which CSR's numbers they see." };
  if ((await users()).some((x) => x.u === u)) return { error: `${u} already has a login. Use New password or New link instead.` };
  const list = await storedUsers();
  const pw = newPassword();
  const user: PulseUser = { u, name, role, ...(role === "rep" ? { rep: slug } : role === "csr" ? { csr: slug } : {}), hash: hash(pw) };
  const token = makeLink(user);
  list.push(user);
  await saveUsers(list);
  revalidatePath("/pulse/hq/people");
  await keepLinkCopy(u, sealLink(token));
  return { done: `Added ${name}.`, who: u, password: pw, link: linkUrl(token) };
}

export async function resetPassword(_: PeopleState, form: FormData): Promise<PeopleState> {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const u = String(form.get("u") || "");
  const { list, me } = await editable(u);
  if (!me) return { error: `No login called ${u}.` };
  const pw = newPassword();
  me.hash = hash(pw);
  await saveUsers(list);
  revalidatePath("/pulse/hq/people");
  return { done: `New password for ${me.name}. Their old sessions are signed out.`, who: u, password: pw };
}

export async function newLink(_: PeopleState, form: FormData): Promise<PeopleState> {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const u = String(form.get("u") || "");
  const { list, me } = await editable(u);
  if (!me) return { error: `No login called ${u}.` };
  const token = makeLink(me);
  await saveUsers(list);
  revalidatePath("/pulse/hq/people");
  await keepLinkCopy(u, sealLink(token));
  return { done: `New sign-in link for ${me.name}. The old link stops working.`, who: u, link: linkUrl(token) };
}

export async function removeLogin(_: PeopleState, form: FormData): Promise<PeopleState> {
  let s;
  try { s = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const u = String(form.get("u") || "");
  if (u === s.u) return { error: "You can't remove your own login." };
  const list = await storedUsers();
  if (!list.some((x) => x.u === u)) return { error: `${u} comes from the PULSE_USERS setting in Vercel. Remove it there.` };
  await saveUsers(list.filter((x) => x.u !== u));
  revalidatePath("/pulse/hq/people");
  return { done: `Removed ${u}. Their sessions end now.` };
}

/** After the first login, the admin lands on People; anyone else who opens /pulse/setup goes home. */
export async function goHome() {
  const s = await getSession();
  redirect(s ? homeOf(s.role) : "/pulse");
}
