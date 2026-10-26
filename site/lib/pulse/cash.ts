import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";

// The cash balance on the Scorecard. It isn't in the CRM: the owner of Cash Balance (or any leadership login)
// types the bank balance in on the page. One private file keeps the last 52 entries, newest first.
// Local dev without Blob uses a folder.

export type CashEntry = { amount: number; at: string; by: string; name: string };

const FILE = "scorecard/cash.json";
const LOCAL = path.join(process.cwd(), "pipeline", ".cache", "scorecard-cash.json");
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);

export async function listCash(): Promise<CashEntry[]> {
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

export async function addCash(e: CashEntry) {
  const all = [e, ...(await listCash())].slice(0, 52);
  const body = JSON.stringify(all);
  if (useBlob()) {
    await put(FILE, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  } else {
    await fs.mkdir(path.dirname(LOCAL), { recursive: true });
    await fs.writeFile(LOCAL, body);
  }
  return all;
}
