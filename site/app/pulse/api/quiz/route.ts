import { NextResponse, type NextRequest } from "next/server";
import { getSession, VIEW_ONLY } from "@/lib/pulse/auth";
import { allAttempts, board, grade, lastWeek, publicQ, questionsFor, quizWeek, readAttempt, saveAttempt, type Attempt } from "@/lib/pulse/quiz";
import { pageOn } from "@/lib/pulse/config";

// The weekly Speed Round. GET: this week's status and leaderboard. POST start: serve the current question (begins your
// one game the first time; the clock starts when the question is served). POST answer: graded against the server's
// clock; the next question waits until you ask for it, so reading an explanation never costs time. Answers never leave early.
export const dynamic = "force-dynamic";

async function boards(week: string, u: string) {
  const b = board(await allAttempts(week));
  const me = b.find((x) => x.u === u) ?? null;
  const prev = board(await allAttempts(lastWeek(week))).filter((x) => x.rank <= 3);
  return { board: b.slice(0, 10), me, players: b.length, lastWeek: prev };
}

export async function GET() {
  if (!pageOn("speed_round")) return new Response("Not found", { status: 404 });
  const s = (await getSession());
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const week = quizWeek();
  const qs = await questionsFor(week, s);
  const a = await readAttempt(week, s.u);
  const out: Record<string, unknown> = { week, ready: !!qs, n: qs?.length ?? 0, status: !a ? "new" : a.done ? "done" : "playing", ...(await boards(week, s.u)) };
  if (a && !a.done && qs) out.at = a.i;
  if (a?.done && qs) out.review = a.answers.map((x) => ({ ...x, question: qs[x.i].question, choices: qs[x.i].choices, answer: qs[x.i].answer, why: qs[x.i].why, topic: qs[x.i].topic }));
  if (a) out.score = a.score;
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  if (!pageOn("speed_round")) return new Response("Not found", { status: 404 });
  const s = (await getSession());
  if (s?.view) return NextResponse.json({ error: VIEW_ONLY }, { status: 403 });
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const week = quizWeek();
  const qs = await questionsFor(week, s);
  if (!qs) return NextResponse.json({ error: "This week's Speed Round is not ready yet. Check back soon." }, { status: 404 });
  let a = await readAttempt(week, s.u);

  if (b.action === "start") {
    if (a?.done) return NextResponse.json({ error: "You already played this week. New questions Monday." }, { status: 409 });
    const now = new Date().toISOString();
    if (!a) a = { week, u: s.u, name: s.name, role: s.role, started: now, i: 0, servedAt: null, answers: [], score: 0, ms: 0, done: false } as Attempt;
    if (!a.servedAt) { a.servedAt = now; await saveAttempt(a); }
    return NextResponse.json({ current: { ...publicQ(qs[a.i], a.i, qs.length), msLeft: Math.max(0, qs[a.i].seconds * 1000 - (Date.now() - Date.parse(a.servedAt))) }, score: a.score });
  }

  if (b.action === "answer") {
    if (!a || a.done || !a.servedAt) return NextResponse.json({ error: "Start the game first." }, { status: 400 });
    if (b.i !== a.i) return NextResponse.json({ error: "That question is already done." }, { status: 409 });
    const q = qs[a.i];
    const ms = Date.now() - Date.parse(a.servedAt);
    const choice = Number.isInteger(b.choice) && b.choice >= 0 && b.choice < q.choices.length ? b.choice : null;
    const g = grade(q, choice, ms);
    a.answers.push({ i: a.i, choice, correct: g.correct, points: g.points, ms: Math.min(ms, q.seconds * 1000) });
    a.score += g.points;
    a.ms += Math.min(ms, q.seconds * 1000);
    a.i += 1;
    a.servedAt = null;
    a.done = a.i >= qs.length;
    await saveAttempt(a);
    const res: Record<string, unknown> = { correct: g.correct, late: g.late, answer: q.answer, why: q.why, points: g.points, score: a.score, done: a.done };
    if (a.done) Object.assign(res, await boards(week, s.u));
    return NextResponse.json(res);
  }
  return NextResponse.json({ error: "Bad request." }, { status: 400 });
}
