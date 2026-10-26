"use client";
import { useEffect, useState } from "react";

// A random one-liner when someone signs in. Kept positive: it can brag about a top-3 spot or open quotes,
// never a weak number. Shows once per browser session, or right after a sign-in link.
// A small note at the bottom of the screen that fades after a few seconds, so it never pushes the numbers down.

type Props = { first: string; role: "rep" | "lead"; rank?: { place: number; board: string } | null; openQuotes?: { count: number; value: string } | null; lastWeekJobs?: number | null };

const REP = [
  "{first} has entered the building. The roofs just got nervous.",
  "Welcome back, {first}. The shingles missed you.",
  "{first} is online. Somewhere in Massapequa a homeowner just felt the urge to sign.",
  "Coffee: check. Numbers: loaded. Excuses: not found. Welcome, {first}.",
  "Fuggedaboutit, {first}. Your numbers are right here.",
  "{first} logged in. A gutter in Smithtown just straightened itself.",
  "Rise and grind, {first}. Roofs don't sell themselves. Yet.",
  "Look who it is. {first}, the closer. Go get 'em.",
  "{first}, every no is just a yes that hasn't heard your pitch.",
  "Welcome back, {first}. The leaderboard has a spot with your name on it.",
];
const LEAD = [
  "Welcome back, {first}. The numbers are in and the coffee's still hot.",
  "Boss mode activated. Welcome back, {first}.",
  "{first} is here. Everybody look busy.",
  "{first}, the Pulse is beating. Let's see who's carrying the team.",
  "Welcome, {first}. Fresh from the CRM. No spin, just numbers.",
];

function pick(p: Props) {
  const lines = (p.role === "lead" ? LEAD : REP).slice();
  if (p.rank && p.rank.place <= 3) lines.push(`{first}, you're #${p.rank.place} in ${p.rank.board} this month. Act humble. Or don't.`, `#${p.rank.place} in ${p.rank.board}, {first}. The other guys are reading this too. Kidding. They're not.`);
  if (p.openQuotes && p.openQuotes.count > 0) lines.push(`{first}, you've got ${p.openQuotes.count} open quotes worth ${p.openQuotes.value}. They're not going to close themselves.`);
  if (p.lastWeekJobs) lines.push(`{first}, the team sold ${p.lastWeekJobs} jobs last week. Let's see what this week brings.`);
  return lines[Math.floor(Math.random() * lines.length)].replace(/\{first\}/g, p.first);
}

export default function Welcome(p: Props) {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    let show = location.search.includes("welcome=1");
    try { if (!sessionStorage.getItem("rr.welcomed")) { show = true; sessionStorage.setItem("rr.welcomed", "1"); } } catch {}
    if (!show) return;
    setLine(pick(p));
    const id = setTimeout(() => setLine(null), 5000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!line) return null;
  return (
    <button type="button" className="welcome" onClick={() => setLine(null)} aria-live="polite" title="Tap to close">
      {line}
    </button>
  );
}
