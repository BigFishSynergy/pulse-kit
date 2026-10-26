// "What can I do with this?" cards: what each section shows, why it matters, and how to use it.
// Plain words, a few lines each. `rep` replaces the leadership wording where a rep sees the section differently.

export type Teach = { title: string; what: string; why: string; how: string[] };
type Entry = Teach & { rep?: Partial<Teach> };

const T: Record<string, Entry> = {
  scoreboard: {
    title: "Scorecard",
    what: "The leadership numbers as a board of boxes: last week, the month so far or the quarter so far. On top, the three things to fix first and which manager has red boxes.",
    why: "It's the weekly leadership scorecard at a glance, plus the month and quarter, so the leadership meeting starts with what's off.",
    how: ["Green is on goal, amber is close, red is behind. No goal, no color.", "Week matches the scorecard: the last full Monday to Sunday. Close rate, ticket and GP use the 30 days ending that Sunday.", "Backlog is green from 3 to 5 weeks of the weekly revenue goal. Under 3, sell more. Over 5, add crews.", "Close rate is graded for today's sales team and each rep. The company number is there to compare.", "Cash isn't in the CRM. Tap Type in cash on its box each Monday."],
  },
  strip: {
    title: "The top numbers",
    what: "Sales, revenue and jobs sold for the week, month, quarter or year, against the same dates last year. Close rate is always the last 30 days.",
    why: "It's the 10-second answer to \"are we winning?\"",
    how: ["Color only comes from the goal: green is at or above goal or pace, amber is close, red is behind. No goal, no color.", "Last year is the gray line under each number.", "Open Options to switch between week, month, quarter and year."],
  },
  priorities: {
    title: "Priorities",
    what: "The 3 or 4 things most worth getting ahead of, ranked, each with an owner, the numbers behind it and a first step.",
    why: "It turns the whole page into a short to-do list for the week.",
    how: ["Start the weekly leadership meeting here.", "Each one cites a number on this page, so you can check it.", "New every Monday."],
  },
  notes: {
    title: "Worth knowing",
    what: "Records, streaks, big jumps and pace calls pulled from this week's numbers.",
    why: "Quick wins to celebrate and early warnings to act on.",
    how: ["Read it before the meeting.", "Share the good ones with the team.", "New every Monday."],
  },
  raise: {
    title: "Raise this week",
    what: "Questions for specific people to bring up in this week's meetings, each tied to a number.",
    why: "Better meetings: you walk in knowing what to ask and who to ask.",
    how: ["Use it as your meeting agenda.", "Ask Claude to dig into any of them first.", "New every Monday."],
  },
  team: {
    title: "This week for each person",
    what: "A coaching card for each person: one thing to remember, one win, one thing to sharpen.",
    why: "Everyone gets a specific, positive nudge every week. Reps see only their own card.",
    how: ["Use the wins to recognize people in the meeting.", "The sharpen point is the one change that would help them most.", "Tap a rep's name to open their screen."],
  },
  scorecard: {
    title: "Scorecard",
    what: "Every key number for the period against the same dates last year and the quarter goal: leads, appointments, sits, close rate, sales, revenue and more.",
    why: "Shows exactly which part of the funnel is ahead or behind.",
    how: ["Red pace means behind the goal for this point in the quarter.", "Open Options to change the period.", "Ask Claude \"why is this behind?\" for a plain-English answer."],
  },
  compare: {
    title: "This year against past years",
    what: "A running total for the week, month, quarter or year, one line per year.",
    why: "You see at a glance whether this year is ahead of past years at the same point.",
    how: ["Thick white is this year, red dashed is last year.", "Tap a year under the chart to hide or show it.", "Open Options to change the metric or the period."],
  },
  trend: {
    title: "13-week trend",
    what: "The last 13 weeks as bars, with the 12-week average as a red line.",
    why: "Spots a hot or cold streak before it shows up in the quarter numbers.",
    how: ["The white bar is last week.", "Bars above the red line beat the average.", "Open Options to see months instead."],
  },
  map: {
    title: "The map",
    what: "Every zip in the service area, colored by results. Brighter green is better, taller means more volume. Zips outside the area are the gray block.",
    why: "Shows where to send reps and where to spend ad money.",
    how: ["Tap a zip for its funnel, lead channels, open quotes and Census market.", "Under the map: Double down (push here), Look closer, Pull back (stop paying for these leads), Untapped (lots of homes, few leads).", "Open Options to change the metric, time window or channel."],
    rep: {
      what: "Your zips, colored by your results. Brighter green is better.",
      why: "Shows where you close best and where your open quotes are.",
      how: ["Tap a zip to see your results there.", "Where you close best: ask for more appointments in those towns.", "Open quotes by town: plan your follow-up route."],
    },
  },
  counties: {
    title: "Region by region",
    what: "The service area's regions side by side: leads, booking, close rate, ticket, sales per lead, open quotes, homes and roof market.",
    why: "Shows which region gives more per lead and where there's room to grow.",
    how: ["Green marks the best region on each line.", "Leads per 1,000 homes shows how much of each market we reach.", "Open Options to change the time window."],
  },
  close: {
    title: "Close rate",
    what: "Close rate for the sales team and the whole company: demos signed in the window divided by demos held in it.",
    why: "Close rate is the biggest single lever on sales.",
    how: ["A sale counts the day it is signed, so a closed week's number never changes.", "Compare to the same point last year, not to last week."],
  },
  reps: {
    title: "Reps",
    what: "Each rep's last 90 days: sits, close rate, sales and ticket.",
    why: "Shows who is carrying the team and who needs a hand.",
    how: ["Tap a name to see exactly what that rep sees.", "Pair it with Player cards and Moneyball."],
  },
  meter: {
    title: "Hot and cold",
    what: "How many of each rep's last 10 demos sold, as a temperature: On fire 6+, Hot 5, Warm 3 or 4, Cold 2, Ice cold 0 or 1.",
    why: "Shows who is on a streak and who needs a hand right now, while there is still time to turn it around.",
    how: ["Every contract signed since the 10th demo counts, so one deal moves a rep up right away.", "The strip shows the last 120 days, oldest on the left.", "Cold or Ice cold is a good time for a ride-along. Reps only ever see their own."],
    rep: {
      title: "My meter",
      what: "How many of your last 10 demos sold: On fire 6+, Hot 5, Warm 3 or 4, Cold 2, Ice cold 0 or 1.",
      why: "A quick read on your streak. Only you see it.",
      how: ["One signed deal moves you up right away.", "Days off never cool you down; only demos count.", "The strip shows your last 120 days."],
    },
  },
  cards: {
    title: "Player cards",
    what: "Each rep's POWER number over the last 90 days, built from six skills: Moneymaker, Closer, Big Ticket, Workhorse, Quick Close and Self-Gen. The team average is 75 in every skill.",
    why: "One fair score where different strengths count, so a big-ticket closer and a high-volume rep can compete. Everyone is rated on the same 90 days, and a rep earns a card at 30 demos.",
    how: ["The red tick on each bar is the team average.", "A rep earns a card at 30 demos; until then you see how many to go.", "The record book shows the highest POWER ever and how long the current #1 has held the top.", "What it takes to hit 85 and 90 turns each skill into a real number.", "Quick Close board: days from appointment to signed contract by rep, last 30 days."],
    rep: {
      title: "My player card",
      what: "Your POWER number over the last 90 days from six skills, and the top 3 on the team. The team average is 75.",
      why: "Shows your strengths and the one skill that would move you up fastest.",
      how: ["The red tick on each bar is the team average. Raise your lowest bar to climb.", "What it takes to hit 85 and 90 shows the real numbers.", "Your card unlocks after 90 days in the field. Your place is just for you."],
    },
  },
  marketing: {
    title: "Marketing",
    what: "Leads by source by month, plus ad spend where it's filled in.",
    why: "Shows which channels are growing and what you pay for them.",
    how: ["Pair it with Lead sources to see what each channel turns into.", "Fill in monthly spend on the sheet so cost per lead shows."],
  },
  sources: {
    title: "Lead sources",
    what: "Each lead source over the last 90 days: leads, booking, demo conversion (demos held that signed) and sales.",
    why: "Tells you which channels to feed and which to cut.",
    how: ["Sorted by sales.", "Tap a source to see the sub sources inside it.", "Sales per lead is the fairest way to compare channels."],
  },
  production: {
    title: "Production",
    what: "Revenue and jobs installed, days from sold to installed, upgrades, month by month, and this week's installs.",
    why: "Getting sold work installed fast means cash in the door and happy customers.",
    how: ["Tap any month in Month by month, or This month in Options, to open a calendar and pick any month back to 2023.", "Days sold to installed: lower is better.", "Installs this week shows what's done and what's still scheduled."],
  },
  cycle: {
    title: "Cycle time",
    what: "How many days each step takes, from a lead coming in to the job being completed.",
    why: "Slow steps cost sales and cash. The by-month chart shows when busy season slows things down.",
    how: ["Tap a clock to chart that step.", "Each year is its own line, so you can see which months run slow.", "Open Options to change the window."],
  },
  costs: {
    title: "Job costing and GP",
    what: "Gross profit on closed jobs against the 37% goal, where every dollar of job value went, crews, vendors, discounts and cost flags.",
    why: "Sales only count if the jobs make money.",
    how: ["The bar shows material, labor, commission and the rest as a share of job value.", "Discounts over the max in the rules are flagged.", "Cost flags are the CRM records to fix so GP is accurate."],
    rep: {
      title: "My GP and discounts",
      what: "Your gross profit on closed jobs against the 37% goal, and your discounts.",
      why: "Higher GP and fewer discounts over the max means more profit on every job you sell.",
      how: ["Stay inside the discount max in the company rules.", "Tap a job number to open the job in the CRM."],
    },
  },
  flags: {
    title: "Data flags",
    what: "Records that look mislabeled in the CRM this quarter.",
    why: "Clean data keeps every number on this page right.",
    how: ["Each flag shows the records and who can fix them.", "Fix it in the CRM and it clears on the next update."],
  },
  mynumbers: {
    title: "My numbers",
    what: "Your sales, jobs, sits, ticket and self-gen leads for the week, month, quarter or year, against last year. Close rate is always your last 30 days.",
    why: "Your scoreboard.",
    how: ["Last year is the gray line under each number.", "Open Options to change the period."],
  },
  thisweek: {
    title: "This week",
    what: "Your coaching card: one thing to remember, one win, one thing to sharpen.",
    why: "One specific thing to work on this week, straight from your own numbers.",
    how: ["New every Monday.", "Ask Claude how to work on your sharpen point."],
  },
  boards: {
    title: "Leaderboards",
    what: "Top 3 on the team for sales, jobs, close rate, ticket and self-gen, plus your own spot.",
    why: "Friendly competition. Only you see your own place.",
    how: ["Most improved compares this month to last month.", "Open Options to change the period."],
  },
  mytrend: {
    title: "My trend",
    what: "Your last 13 weeks as bars, with the same week last year behind each bar.",
    why: "Shows your streaks and whether you're beating last year.",
    how: ["Gray behind each bar is the same week last year.", "Open Options to see months instead."],
  },
  followups: {
    title: "My follow-ups",
    what: "Your quoted appointments that haven't sold yet, newest first.",
    why: "Money still on the table. Follow-ups close deals.",
    how: ["Start with the newest and the hottest rating.", "Tap a record to open it in the CRM.", "Ask Claude \"Which follow-ups first?\""],
  },
};

export function teach(k: string, role: "lead" | "rep"): Teach | null {
  const e = T[k];
  if (!e) return null;
  const { rep, ...base } = e;
  return role === "rep" && rep ? { ...base, ...rep } : base;
}
