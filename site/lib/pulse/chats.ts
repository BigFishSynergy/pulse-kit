import "server-only";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { del, get, put } from "@vercel/blob";

// Saved Ask Claude chats, private to each person: chats/<user>/<id>.json plus chats/<user>/index.json for the list.
// Nobody else can open them, leadership included. Local dev without Blob uses a folder.

export type Turn = { role: "user" | "assistant"; content: string };
export type Chat = { id: string; title: string; at: string; updated: string; rep?: string; turns: Turn[] };
export type ChatMeta = Omit<Chat, "turns"> & { n: number };

const KEEP = 50; // newest chats kept per person
const MAX_TURNS = 60;
const LOCAL = path.join(process.cwd(), "pipeline", ".cache");
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);
const SAFE_USER = /^[a-z0-9_-]{1,40}$/i;
export const CHAT_ID = /^[0-9]{14}-[0-9a-f]{6}$/;

async function read<T>(file: string): Promise<T | null> {
  if (useBlob()) {
    const r = await get(file, { access: "private", useCache: false });
    return r?.statusCode === 200 ? (JSON.parse(await new Response(r.stream).text()) as T) : null;
  }
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function write(file: string, body: unknown) {
  const text = JSON.stringify(body);
  if (useBlob()) {
    await put(file, text, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  } else {
    await fs.mkdir(path.dirname(path.join(LOCAL, file)), { recursive: true });
    await fs.writeFile(path.join(LOCAL, file), text);
  }
}

async function remove(file: string) {
  if (useBlob()) await del(file).catch(() => {});
  else await fs.rm(path.join(LOCAL, file), { force: true });
}

const dir = (u: string) => {
  if (!SAFE_USER.test(u)) throw new Error("Bad user");
  return `chats/${u.toLowerCase()}`;
};

export async function listChats(u: string): Promise<ChatMeta[]> {
  return (await read<ChatMeta[]>(`${dir(u)}/index.json`)) ?? [];
}

export async function getChat(u: string, id: string): Promise<Chat | null> {
  return CHAT_ID.test(id) ? read<Chat>(`${dir(u)}/${id}.json`) : null;
}

/** Save a chat (new when id is missing). Returns the saved chat's id. Old chats past KEEP are deleted. */
export async function saveChat(u: string, input: { id?: string; rep?: string; turns: Turn[] }): Promise<string> {
  const now = new Date().toISOString();
  const turns = input.turns
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));
  const index = await listChats(u);
  const old = input.id && CHAT_ID.test(input.id) ? index.find((c) => c.id === input.id) : undefined;
  const id = old?.id ?? `${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
  const first = turns.find((t) => t.role === "user")?.content ?? "New chat";
  const chat: Chat = { id, title: old?.title ?? first.replace(/\s+/g, " ").slice(0, 80), at: old?.at ?? now, updated: now, rep: input.rep || undefined, turns };
  await write(`${dir(u)}/${id}.json`, chat);
  const meta: ChatMeta = { id, title: chat.title, at: chat.at, updated: now, rep: chat.rep, n: turns.length };
  const next = [meta, ...index.filter((c) => c.id !== id)].sort((a, b) => b.updated.localeCompare(a.updated));
  for (const c of next.slice(KEEP)) await remove(`${dir(u)}/${c.id}.json`);
  await write(`${dir(u)}/index.json`, next.slice(0, KEEP));
  return id;
}

export async function deleteChat(u: string, id: string) {
  if (!CHAT_ID.test(id)) return false;
  await remove(`${dir(u)}/${id}.json`);
  await write(`${dir(u)}/index.json`, (await listChats(u)).filter((c) => c.id !== id));
  return true;
}
