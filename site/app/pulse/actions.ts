"use server";
import { redirect } from "next/navigation";
import { checkLogin, homeOf, safeNext, startSession, users, type Role } from "@/lib/pulse/auth";
import { record } from "@/lib/pulse/activity";
import { adminFirst } from "@/lib/pulse/config";
import { canSendLinks, sendable, sendLink } from "@/lib/pulse/sendlink";
import { INBOX } from "@/lib/pulse/slack";

export type LoginState = { error?: string };

async function login(role: Role, form: FormData): Promise<LoginState> {
  const user = await checkLogin(String(form.get("username") || ""), String(form.get("password") || ""), role);
  if (!user) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: `That name and password do not match. Ask ${adminFirst()} if you need a new password.` };
  }
  startSession(user);
  await record({ u: user.u, name: user.name, role: user.role, rep: user.rep }, "signin");
  const next = role === "lead" ? safeNext(form.get("next")) : null;
  redirect(next ?? homeOf(user.role));
}

export async function loginRep(_: LoginState, form: FormData) {
  return login("rep", form);
}

export async function loginLead(_: LoginState, form: FormData) {
  return login("lead", form);
}

export type LinkState = { done?: string };

/** "Send my link" on the sign-in pages. The link only ever goes to that person's own Slack or email, and the answer is the
 * same, after the same wait, whatever name is typed, so the page never says who has a login. */
export async function sendMyLink(_: LinkState, form: FormData): Promise<LinkState> {
  const t = Date.now();
  const name = String(form.get("username") || "").trim().toLowerCase();
  const u = (await users()).find((x) => x.u.toLowerCase() === name);
  if (u && sendable(u) && canSendLinks()) await sendLink(u, { self: true });
  await new Promise((r) => setTimeout(r, Math.max(0, 1500 - (Date.now() - t))));
  return { done: `If that name is on the Pulse, your link is on its way. Look for it ${INBOX}.` };
}
