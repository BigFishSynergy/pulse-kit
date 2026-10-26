import { REGIONS } from "@/lib/pulse/county";

// Starter questions for Ask Claude: [button label, the full question sent]. Numbers first, then how-to.

export const LEAD_ASK: [string, string][] = [
  ["What should we optimize for?", "What should we optimize for this month: more leads, better booking, or a higher close rate? Use the numbers."],
  ["Where's the biggest leak?", "Where is the biggest leak in our funnel, from lead to appointment to sit to sale?"],
  ["Whose strength should the team copy?", "Which rep has a strength the rest of the team should copy, and what exactly is it?"],
  ["Which towns are we missing?", "Which towns have lots of homes but few leads from us, and are worth more marketing?"],
  ["What weekly numbers hit the goal?", "To hit this quarter's sales goal from here, what do we need each week in sits, close rate and average ticket?"],
  ["What changed most?", "What changed most since last month, good and bad?"],
  ["Best sales per lead?", "Which lead source has the best sales per lead, and are we feeding it enough?"],
  ["Sold to installed speed?", "How long does it take from sold to installed, and is it getting better?"],
  ["What could keep us from the goal?", "What is the one thing most likely to keep us from hitting this quarter's goal?"],
  ["Where should marketing money go?", "Which lead sources should get more money and which should get less, based on these numbers?"],
  ["How does this quarter compare to past years?", "How does this quarter compare to the same quarter in past years, and what usually happens next?"],
  [`${REGIONS.join(" or ")}?`, `How do ${REGIONS.join(" and ")} compare on leads, close rate, average ticket and sales?`],
  ["Which towns should we double down on?", "Which towns or zip codes should marketing double down on, and why?"],
  ["What should sales focus on?", "What should the sales manager focus on with the sales team this week?"],
];

export const LEAD_HELP: [string, string][] = [
  ["How do I build a report by town?", "How do I build a report of close rate and sales by town for last quarter?"],
  [`How do I compare ${REGIONS.join(" and ")}?`, `How do I compare ${REGIONS.join(" and ")} side by side?`],
  ["What can the map do?", "What can I do with the map, and what do the lists under it mean?"],
  ["How do I make a graphic?", "How do I make a graphic for Instagram from our numbers?"],
  ["How do I see a rep's screen?", "How do I see exactly what one of the reps sees?"],
  ["How do I share a report?", "How do I save or share a report I built?"],
  ["What's on the Pulse?", "Walk me through what's on the Pulse page, top to bottom."],
];

export const REP_ASK: [string, string][] = [
  ["What one number should I focus on?", "What is the one number I should focus on this week to sell more, and why that one?"],
  ["Where am I losing deals?", "Where am I losing deals: getting in front of people, or closing once I'm there? Use my numbers."],
  ["Where do I close best?", "Which towns and lead sources do I close best in, and where should I look for more appointments?"],
  ["What's my strongest skill?", "Based on my numbers, what is my strongest skill as a salesperson, and how can I use it more?"],
  ["What do my best weeks have in common?", "Look at my best weeks this year. What do they have in common that I could repeat?"],
  ["How do I raise my ticket?", "How does my average ticket compare to the team, and what would raise it?"],
  ["Which follow-ups first?", "Which of my open quotes should I follow up on first this week, and why?"],
  ["How many sits for my goal?", "If I want $100,000 in sales this month, how many sits do I need at my current close rate and ticket?"],
  ["Me vs last year?", "How am I doing this quarter compared to the same time last year?"],
  ["3-step plan to beat my best month", "Give me a 3-step plan to beat my best month, using my own numbers."],
  ["How do I get on the leaderboard?", "What would it take for me to get into the top 3 on a leaderboard this month?"],
  ["Am I getting enough self-gen?", "How many self-gen leads am I bringing in, and what is a realistic target for next month?"],
];

export const REP_HELP: [string, string][] = [
  ["How do I see where I close best?", "How do I see where I close best on my map?"],
  ["How do I build my own report?", "How do I build a report of my sales by month?"],
  ["What are follow-ups?", "What is the My follow-ups list and how should I use it?"],
  ["How do I make a graphic?", "How do I make a graphic of my month to share?"],
  ["How do leaderboards work?", "How do the leaderboards work, and who can see my spot?"],
];
