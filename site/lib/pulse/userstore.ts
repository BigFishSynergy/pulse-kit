import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import { get, put } from "@vercel/blob";
import type { PulseUser } from "./auth";

// Where Pulse logins live: one private file in the company's Blob store (admin/users.json), managed from the People page
// (/pulse/hq/people) by the admin, so nobody needs a terminal. Passwords and sign-in links are stored only as one-way
// hashes. Logins in the PULSE_USERS environment variable (from the older users.mjs tool) still work and are merged in;
// a login saved on the People page wins over one with the same name there. Local development without Blob uses a
// git-ignored file instead.
const FILE = "admin/users.json";
const LOCAL = path.join(process.cwd(), "pipeline", ".cache", "users.json");
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);

function fromEnv(): PulseUser[] {
  try {
    const list = JSON.parse(process.env.PULSE_USERS || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Logins saved on the People page (not the environment ones). */
export async function storedUsers(): Promise<PulseUser[]> {
  try {
    if (useBlob()) {
      const r = await get(FILE, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return [];
      return JSON.parse(await new Response(r.stream).text());
    }
    return JSON.parse(await fs.readFile(LOCAL, "utf8"));
  } catch {
    return [];
  }
}

/** Every login, read once per request. */
export const allUsers = cache(async (): Promise<PulseUser[]> => {
  const saved = await storedUsers();
  const names = new Set(saved.map((u) => u.u));
  return [...saved, ...fromEnv().filter((u) => !names.has(u.u))];
});

export async function saveUsers(list: PulseUser[]) {
  const body = JSON.stringify(list);
  if (useBlob()) {
    await put(FILE, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  } else {
    await fs.mkdir(path.dirname(LOCAL), { recursive: true });
    await fs.writeFile(LOCAL, body);
  }
}

/** True when the environment holds this login (the People page can't change those; it saves a copy that wins). */
export const inEnv = (u: string) => fromEnv().some((x) => x.u === u);
