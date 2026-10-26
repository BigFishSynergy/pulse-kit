import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { get } from "@vercel/blob";
import { unstable_cache } from "next/cache";
import { CONFIG } from "./config";

// The hourly data job (site/pipeline, run by .github/workflows/pulse-data.yml) uploads JSON to a private
// Vercel Blob store connected to this project. Pages read it here, on the server only, and pass each person just
// the files their role may see. Local dev can point PULSE_DATA_DIR at a folder with the same layout.
// Fallback: the pulse-data branch on GitHub, when PULSE_DATA_TOKEN is set and Blob is not.

const REPO = process.env.PULSE_DATA_REPO || process.env.VERCEL_GIT_REPO_OWNER + "/" + process.env.VERCEL_GIT_REPO_SLUG;
const BRANCH = process.env.PULSE_DATA_BRANCH || "pulse-data";
const SAFE = /^[a-z0-9][a-z0-9/_.-]*\.json$/;
export const WEEK = /^\d{4}-\d{2}-\d{2}$/;

// What the team actually calls people (pulse.config.json people.nicknames). The CRM keeps the full name; every page,
// card, report and Ask Claude answer shows the nickname. Swapped in the raw text, so every file stays consistent.
const NICKNAMES: [string, string][] = Object.entries(CONFIG.people.nicknames ?? {}).filter(([k]) => !k.startsWith("_"));
const nick = (text: string) => NICKNAMES.reduce((t, [full, short]) => t.split(full).join(short), text);
const parse = (text: string) => JSON.parse(nick(text));

// Blob reads are cached for 5 minutes per file. The job runs hourly, so pages are never more than a few minutes behind it.
const fromBlob = unstable_cache(
  async (file: string) => {
    const r = await get(file, { access: "private" });
    if (!r || r.statusCode !== 200) return null;
    return parse(await new Response(r.stream).text());
  },
  ["pulse-blob-1"],
  { revalidate: 300, tags: ["pulse-data"] },
);

async function readJson<T>(file: string): Promise<T | null> {
  if (!SAFE.test(file) || file.includes("..")) throw new Error(`Bad data path: ${file}`);
  const local = process.env.PULSE_DATA_DIR;
  if (local) {
    try {
      return parse(await fs.readFile(path.join(local, file), "utf8")) as T;
    } catch {
      return null;
    }
  }
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL) {
    try {
      return (await fromBlob(file)) as T | null;
    } catch (e) {
      if (!process.env.PULSE_DATA_TOKEN) throw e;
    }
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}?ref=${BRANCH}`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${process.env.PULSE_DATA_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 300, tags: ["pulse-data"] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Pulse data ${file}: ${res.status}`);
  return parse(await res.text()) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Meta = {
  as_of: string;
  pulled_at: string;
  pulled_iso: string;
  generated_at: string;
  week_start: string;
  week_end: string;
  quarter: { label: string };
  spend_months: string[];
};
export type WeekIndex = { week_start: string; week_end: string; pulled_at: string }[];

const base = (week?: string) => (week && WEEK.test(week) ? `weeks/${week}` : "latest");

export const getMeta = (week?: string) => readJson<Meta>(`${base(week)}/meta.json`);
export const getWeeks = async () => (await readJson<WeekIndex>("weeks/index.json")) ?? [];
/** A ?week= that matches a saved week, or undefined for the latest numbers. */
export async function pickWeek(w?: string) {
  if (!w || !WEEK.test(w)) return undefined;
  return (await getWeeks()).some((x) => x.week_start === w) ? w : undefined;
}
export const getLeadership = (week?: string) => readJson<any>(`${base(week)}/leadership.json`);
export const getGeo = (week?: string) => readJson<any>(`${base(week)}/geo.json`);
export const getPeople = (week?: string) => readJson<any>(`${base(week)}/people.json`);
export const getCoaching = (week: string) => (WEEK.test(week) ? readJson<any>(`coaching/${week}.json`) : Promise.resolve(null));
/** The week's Speed Round, answers included. Server only; lib/pulse/quiz.ts strips answers before anything reaches a browser. */
export const getQuizFile = (week: string) => (WEEK.test(week) ? readJson<any>(`quiz/${week}.json`) : Promise.resolve(null));

/** The Report Builder ledger. Leadership gets the whole company; a rep's file holds only their own records. */
export const getFacts = () => readJson<any>("latest/facts.json");
export const getRepFacts = (slug: string) => (/^[a-z0-9-]+$/.test(slug) ? readJson<any>(`latest/rep-facts/${slug}.json`) : Promise.resolve(null));

export async function getRep(slug: string, week?: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return readJson<any>(`${base(week)}/reps/${slug}.json`);
}

/** One CSR's screen (latest only). */
export async function getCsr(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return readJson<any>(`latest/csrs/${slug}.json`);
}

/** One person's coaching card. Reps only ever get their own. */
export function cardFor(coaching: any, name: string) {
  const team: any[] = coaching?.team ?? [];
  return team.find((c) => c.who === name) ?? null;
}

/** Hours since the CRM produced the data on screen. Over 24 means the page says so. */
export function hoursOld(meta: Meta | null): number | null {
  if (!meta?.pulled_iso) return null;
  return (Date.now() - new Date(meta.pulled_iso).getTime()) / 36e5;
}
