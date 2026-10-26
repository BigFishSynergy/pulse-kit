import "server-only";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { get, list, put } from "@vercel/blob";

// Improvement requests from anyone signed in. One private file per request, so two people sending at once
// never overwrite each other. Leadership sees the list and sets a status. Local dev without Blob uses a folder.

export type Status = "new" | "planned" | "done" | "not_now";
export type Req = {
  id: string; at: string; who: string; name: string; role: "rep" | "lead" | "csr";
  kind: string; text: string; page: string; status: Status; note?: string; updated?: string;
};

const PREFIX = "requests/";
const LOCAL = path.join(process.cwd(), "pipeline", ".cache", "requests");
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);

async function save(r: Req) {
  const body = JSON.stringify(r);
  if (useBlob()) {
    await put(`${PREFIX}${r.id}.json`, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  } else {
    await fs.mkdir(LOCAL, { recursive: true });
    await fs.writeFile(path.join(LOCAL, `${r.id}.json`), body);
  }
}

export async function addRequest(r: Omit<Req, "id" | "at" | "status">) {
  const at = new Date().toISOString();
  const req: Req = { ...r, id: `${at.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`, at, status: "new" };
  await save(req);
  return req;
}

export async function listRequests(): Promise<Req[]> {
  const out: Req[] = [];
  if (useBlob()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      for (const b of page.blobs) {
        const r = await get(b.pathname, { access: "private", useCache: false });
        if (r?.statusCode === 200) out.push(JSON.parse(await new Response(r.stream).text()));
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } else {
    try {
      for (const f of await fs.readdir(LOCAL)) out.push(JSON.parse(await fs.readFile(path.join(LOCAL, f), "utf8")));
    } catch {}
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export async function setStatus(id: string, status: Status, note?: string) {
  if (!/^[0-9]{14}-[0-9a-f]{6}$/.test(id)) return null;
  const all = await listRequests();
  const r = all.find((x) => x.id === id);
  if (!r) return null;
  const next: Req = { ...r, status, note: note?.slice(0, 500) || r.note, updated: new Date().toISOString() };
  await save(next);
  return next;
}
