"use server";
import { redirect } from "next/navigation";
import { checkLogin, homeOf, safeNext, startSession, type Role } from "@/lib/pulse/auth";
import { record } from "@/lib/pulse/activity";
import { adminFirst } from "@/lib/pulse/config";

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
