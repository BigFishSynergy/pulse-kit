import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { del, get, put } from "@vercel/blob";

// Team photos for the POWER cards (the Team page, the Pulse and the office TVs), or an avatar someone picked instead. The admin uploads them on the People page; the
// browser shrinks each to a small square first. Private Blob store, photos/<slug>.jpg, with photos/index.json listing
// who has one (and a version, so a new photo shows right away). Only signed-in people and office TVs can load them
// (/pulse/api/photo/<slug>). Only upload photos people are happy to have on the office TV.
const INDEX = "photos/index.json";
const LOCAL = path.join(process.cwd(), "pipeline", ".cache", "photos");
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);
export const SLUG = /^[a-z0-9-]{1,60}$/;

export async function photoIndex(): Promise<Record<string, number | string>> {
  try {
    if (useBlob()) {
      const r = await get(INDEX, { access: "private", useCache: false });
      return r && r.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : {};
    }
    return JSON.parse(await fs.readFile(path.join(LOCAL, "index.json"), "utf8"));
  } catch {
    return {};
  }
}

async function saveIndex(ix: Record<string, number | string>) {
  const body = JSON.stringify(ix);
  if (useBlob()) await put(INDEX, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  else { await fs.mkdir(LOCAL, { recursive: true }); await fs.writeFile(path.join(LOCAL, "index.json"), body); }
}

export async function savePhoto(slug: string, jpeg: Buffer) {
  if (useBlob()) await put(`photos/${slug}.jpg`, jpeg, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "image/jpeg", cacheControlMaxAge: 60 });
  else { await fs.mkdir(LOCAL, { recursive: true }); await fs.writeFile(path.join(LOCAL, `${slug}.jpg`), jpeg); }
  await saveIndex({ ...(await photoIndex()), [slug]: Date.now() });
}

/** Use one of the 25 avatars instead of a photo (any uploaded photo for this person is deleted). */
export async function chooseAvatar(slug: string, name: string) {
  const { AVATARS } = await import("./faces");
  if (!AVATARS.includes(name)) throw new Error("No such avatar.");
  await saveIndex({ ...(await photoIndex()), [slug]: `avatar:${name}` });
  if (useBlob()) await del(`photos/${slug}.jpg`).catch(() => {});
  else await fs.rm(path.join(LOCAL, `${slug}.jpg`), { force: true });
}

export async function removePhoto(slug: string) {
  const ix = await photoIndex();
  delete ix[slug];
  await saveIndex(ix);
  if (useBlob()) await del(`photos/${slug}.jpg`).catch(() => {});
  else await fs.rm(path.join(LOCAL, `${slug}.jpg`), { force: true });
}

export async function readPhoto(slug: string): Promise<Buffer | null> {
  try {
    if (useBlob()) {
      const r = await get(`photos/${slug}.jpg`, { access: "private", useCache: false });
      return r && r.statusCode === 200 ? Buffer.from(await new Response(r.stream).arrayBuffer()) : null;
    }
    return await fs.readFile(path.join(LOCAL, `${slug}.jpg`));
  } catch {
    return null;
  }
}
