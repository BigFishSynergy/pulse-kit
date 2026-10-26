import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { get, list, put } from "@vercel/blob";
import type { Session } from "./auth";
import { getQuizFile } from "./data";
import { TZ } from "./config";

// The weekly Speed Round. Questions (with answers) come from site/pipeline/quiz.py; they stay on the server.
// One game per person per week. The server times every question, so a slow answer cannot be faked from the browser.
// Attempts: quiz-attempts/<monday>/<user>.json. Local dev without Blob uses a folder.

export type Q = { id: number; kind: "know" | "hunt"; topic: string; question: string; choices: string[]; answer: number; why: string; seconds: number };
export type Answer = { i: number; choice: number | null; correct: boolean; points: number; ms: number };
export type Attempt = { week: string; u: string; name: string; role: string; started: string; i: number; servedAt: string | null; answers: Answer[]; score: number; ms: number; done: boolean };

const GRACE_MS = 2500; // network time allowed past the clock
const LOCAL = path.join(process.cwd(), "pipeline", ".cache");
const useBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);

/** Monday of this week, Eastern time. */
export function quizWeek(d = new Date()) {
  const et = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  et.setDate(et.getDate() - ((et.getDay() + 6) % 7));
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
}
export const lastWeek = (week: string) => new Date(Date.parse(week + "T12:00:00Z") - 7 * 864e5).toISOString().slice(0, 10);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** This player's questions: report hunts become their own version, the spare stands in for one they have no numbers for. */
export async function questionsFor(week: string, s: Session): Promise<Q[] | null> {
  const f: any = await getQuizFile(week);
  if (!f?.questions?.length) return null;
  let spareUsed = false;
  const out: Q[] = [];
  for (const q of f.questions) {
    if (q.kind !== "hunt") { out.push({ ...q, id: out.length }); continue; }
    const v = s.role === "lead" ? q.lead : q.per?.[s.rep ?? ""];
    if (v) out.push({ id: out.length, kind: "hunt", topic: q.topic, seconds: q.seconds, ...v });
    else if (!spareUsed && f.spare) { spareUsed = true; out.push({ ...f.spare, id: out.length }); }
    // a second hunt this player has no numbers for is left out, so the spare never shows twice
  }
  return out;
}

/** What the browser may see of a question: no answer, no explanation. */
export const publicQ = (q: Q, i: number, n: number) => ({ i, n, kind: q.kind, topic: q.topic, question: q.question, choices: q.choices, seconds: q.seconds });

const file = (week: string, u: string) => `quiz-attempts/${week}/${u.toLowerCase()}.json`;

export async function readAttempt(week: string, u: string): Promise<Attempt | null> {
  if (!/^[a-z0-9_-]{1,40}$/i.test(u)) return null;
  if (useBlob()) {
    const r = await get(file(week, u), { access: "private", useCache: false }).catch(() => null);
    return r?.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : null;
  }
  try { return JSON.parse(await fs.readFile(path.join(LOCAL, file(week, u)), "utf8")); } catch { return null; }
}

export async function saveAttempt(a: Attempt) {
  const body = JSON.stringify(a);
  if (useBlob()) await put(file(a.week, a.u), body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  else { await fs.mkdir(path.join(LOCAL, "quiz-attempts", a.week), { recursive: true }); await fs.writeFile(path.join(LOCAL, file(a.week, a.u)), body); }
}

export async function allAttempts(week: string): Promise<Attempt[]> {
  const out: Attempt[] = [];
  if (useBlob()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `quiz-attempts/${week}/`, cursor, limit: 1000 });
      for (const b of page.blobs) {
        const r = await get(b.pathname, { access: "private", useCache: false }).catch(() => null);
        if (r?.statusCode === 200) out.push(JSON.parse(await new Response(r.stream).text()));
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } else {
    try { for (const f of await fs.readdir(path.join(LOCAL, "quiz-attempts", week))) out.push(JSON.parse(await fs.readFile(path.join(LOCAL, "quiz-attempts", week, f), "utf8"))); } catch {}
  }
  return out;
}

/** Points: 100 for a right answer plus up to 50 for speed. Past the clock (plus a little grace) scores zero. */
export function grade(q: Q, choice: number | null, ms: number) {
  const late = ms > q.seconds * 1000 + GRACE_MS;
  const correct = !late && choice === q.answer;
  const left = Math.max(0, 1 - ms / (q.seconds * 1000));
  return { correct, points: correct ? 100 + Math.round(50 * left) : 0, late };
}

/** Finished games, best score first, then fastest. */
export function board(attempts: Attempt[]) {
  // the guest link can play, but the board is the team's
  const done = attempts.filter((a) => a.done && a.u !== "guest").sort((a, b) => b.score - a.score || a.ms - b.ms);
  let place = 0, prev = "";
  return done.map((a, i) => {
    const key = `${a.score}|${a.ms}`;
    if (key !== prev) { place = i + 1; prev = key; }
    return { rank: place, u: a.u, name: a.name, role: a.role, score: a.score, right: a.answers.filter((x) => x.correct).length, n: a.answers.length, secs: Math.round(a.ms / 1000) };
  });
}
