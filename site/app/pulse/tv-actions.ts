"use server";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "@/lib/pulse/auth";
import { siteOrigin } from "@/lib/pulse/links";
import { listScreens, newKey, saveScreens, slideOk, type Audience, type Screen } from "@/lib/pulse/tv";

// TV screens, set up by the admin on /pulse/hq/tv. The link shows once; only its hash is kept.
export type TvState = { error?: string; done?: string; link?: string };

async function admin() {
  if (!isAdmin(await getSession())) throw new Error("Only the Pulse admin can set up TV screens.");
}

export async function addScreen(_: TvState, form: FormData): Promise<TvState> {
  try { await admin(); } catch (e) { return { error: (e as Error).message }; }
  const name = String(form.get("name") || "").trim().slice(0, 60);
  const audience = (form.get("audience") === "office" ? "office" : "floor") as Audience;
  const slides = form.getAll("slides").map(String).filter((k) => slideOk(k, audience));
  const seconds = Math.min(120, Math.max(8, Number(form.get("seconds")) || 15));
  if (!name) return { error: "Give this TV a name, like Sales floor or Front office." };
  if (!slides.length) return { error: "Pick at least one slide." };
  const { token, key } = newKey();
  const s: Screen = { id: key.slice(0, 10), name, audience, slides, seconds, dark: form.get("dark") !== "light", key, at: new Date().toISOString() };
  await saveScreens([...(await listScreens()), s]);
  revalidatePath("/pulse/hq/tv");
  return { done: `${name} is ready.`, link: `${siteOrigin()}/pulse/tv/${token}` };
}

export async function newScreenLink(_: TvState, form: FormData): Promise<TvState> {
  try { await admin(); } catch (e) { return { error: (e as Error).message }; }
  const list = await listScreens();
  const s = list.find((x) => x.id === form.get("id"));
  if (!s) return { error: "That TV is gone." };
  const { token, key } = newKey();
  s.key = key;
  await saveScreens(list);
  revalidatePath("/pulse/hq/tv");
  return { done: `New link for ${s.name}. The old one stops working.`, link: `${siteOrigin()}/pulse/tv/${token}` };
}

export async function removeScreen(_: TvState, form: FormData): Promise<TvState> {
  try { await admin(); } catch (e) { return { error: (e as Error).message }; }
  const list = await listScreens();
  await saveScreens(list.filter((x) => x.id !== form.get("id")));
  revalidatePath("/pulse/hq/tv");
  return { done: "Removed. That TV's link stops working now." };
}
