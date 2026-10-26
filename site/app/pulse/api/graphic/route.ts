import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { getSession, VIEW_ONLY } from "@/lib/pulse/auth";
import { leadContext, repContext } from "@/lib/pulse/context";
import { cardFor, getCoaching, getGeo, getLeadership, getMeta, getRep } from "@/lib/pulse/data";
import { brandFontFaces } from "@/lib/pulse/fonts";
import { logoDataUri } from "@/lib/pulse/logo";
import { CO, CONFIG } from "@/lib/pulse/config";
import { usage } from "@/lib/pulse/usage";
import { sanitize } from "@/lib/pulse/svg";
import { record } from "@/lib/pulse/activity";
import { pageOn } from "@/lib/pulse/config";

// "Make a graphic": Claude designs one on-brand infographic as SVG from the numbers this person may see.
// The server strips anything that could run or load from elsewhere, embeds the brand fonts, and stamps the
// official logo itself, so the mark is never redrawn or recolored.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-opus-5-5";
const DAILY = { lead: 25, rep: 10, csr: 0 };
const SIZES = { square: [1080, 1080], story: [1080, 1920], wide: [1920, 1080] } as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
function brief(W: number, H: number, audience: "internal" | "social", pulled: string) {
  const B = CONFIG.brand.colors;
  return `You design one infographic as a single SVG for ${CO.name}, ${CO.what_we_do} in ${CO.service_area}.

Canvas: width="${W}" height="${H}" viewBox="0 0 ${W} ${H}".

Brand, follow exactly:
- Background #0A0A0A. Headlines #FFFFFF. Body text #D4D4D4. Muted text #8C8C8C. Panels and rules #141414, #1E1E1E, #262626, #3A3A3A.
- Highlight color: the brand accent ${B.accent}, for the winner, the best number, anything going up. Use it with intent, not everywhere.
- The brand primary ${B.primary}, sparingly: one structural accent (a rule or a bar).
- Never use any other color.
- Headlines, labels and big numbers: font-family "Barlow Condensed", font-weight 800 or 900, ALL CAPS, letter-spacing 0.04em. Small text: font-family "Inter", weight 400 or 600.
- Futuristic and high-tech, like a heads-up display 10 years from now: thin straight rules, grids of cells, corner tick marks, bars, big numbers, small uppercase labels. Clean, not busy.
- No rounded corners, no drop shadows, no gradients except a subtle neon glow line if it helps, no emoji, no clip art, no photos, no icons of people.
- Leave the top-left area from (0,0) to (440,150) as plain background. The company logo is placed there afterward. Start your title at y >= 170 or at x >= 480.
- ${audience === "internal" ? `Bottom edge, small muted Inter text: "Data pulled ${pulled}. Counted with ${CO.name}'s rules."` : `Bottom edge, small muted Inter text: "${CO.name} · ${CO.service_area}".`}

Content rules:
- Use only numbers that appear in DATA or REPORT. Never invent, estimate, project or round a number to make it look better. If the request needs a number that is not there, leave that part out.
- Rates show their counts when there is room, like 35.3% (153 of 434).
- Never show customer names, addresses or phone numbers. Refer to jobs only by job number, if at all.
- Celebrate wins by name. Never single out a named person for a weak number.
- Round numbers the way people read them: dollars of $10K or more as $K or $M with one decimal at most ($4.5M, $368K), smaller dollars whole with no cents, counts whole, percentages whole.
- No em dashes. Plain, punchy words.
${audience === "social"
    ? "- This is for social media. Do not show any dollar amounts, profit, margins, close rates, pacing to goals or any rep's individual stats. Good material: jobs installed, roofs completed, towns served, team milestones, five star reviews. Use first names only, and only to celebrate."
    : "- This is for the office and team channels. Dollar amounts and rep names are fine."}

Return only the SVG markup, starting with <svg and ending with </svg>. No markdown fences, no comments, no explanation. Keep it under 400 elements.`;
}

export async function POST(req: NextRequest) {
  if (!pageOn("graphics")) return new Response("Not found", { status: 404 });
  const s = (await getSession());
  if (s?.view) return NextResponse.json({ error: VIEW_ONLY }, { status: 403 });
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The graphic maker is not switched on yet." }, { status: 503 });
  if (s.role === "csr" || (s.role === "rep" && process.env.PULSE_ASK_REPS !== "on")) return NextResponse.json({ error: "The graphic maker is not switched on for the sales team yet." }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const ask = String(body.prompt || "").trim().slice(0, 800);
  if (!ask) return NextResponse.json({ error: "Describe the graphic first." }, { status: 400 });
  const audience: "internal" | "social" = body.audience === "social" ? "social" : "internal";
  const [W, H] = SIZES[(body.format as keyof typeof SIZES) in SIZES ? (body.format as keyof typeof SIZES) : "square"];

  const { n, save } = usage("pulse_gfx", s.u);
  if (n >= DAILY[s.role]) return NextResponse.json({ error: `That is ${DAILY[s.role]} graphics today, the daily limit. It resets tomorrow.` }, { status: 429 });

  const meta = await getMeta();
  if (!meta) return NextResponse.json({ error: "No numbers are loaded yet." }, { status: 503 });
  const coaching = await getCoaching(meta.week_start);
  let data: any;
  if (s.role === "lead" && typeof body.rep === "string" && /^[a-z0-9-]+$/.test(body.rep)) {
    const r = await getRep(body.rep);
    if (!r) return NextResponse.json({ error: "No numbers for that rep." }, { status: 404 });
    data = repContext(r, cardFor(coaching, r.rep));
  } else if (s.role === "lead") {
    const [lead, geo] = await Promise.all([getLeadership(), getGeo()]);
    data = leadContext(lead, geo, coaching);
    delete data.history_by_month; // keeps the request small; the report on screen covers custom ranges
  } else {
    const r = await getRep(s.rep!);
    if (!r) return NextResponse.json({ error: "Your numbers are not loaded yet." }, { status: 503 });
    data = repContext(r, cardFor(coaching, r.rep));
  }
  // The report on screen, as the builder computed it from this person's own ledger.
  const report = body.report && typeof body.report === "object"
    ? JSON.stringify({ title: String(body.report.title || "").slice(0, 200), dates: String(body.report.sub || "").slice(0, 200),
        columns: (body.report.columns || []).slice(0, 12).map((c: any) => String(c).slice(0, 60)),
        rows: (body.report.rows || []).slice(0, 25).map((r: any[]) => (Array.isArray(r) ? r.slice(0, 13).map((x) => String(x).slice(0, 60)) : [])) })
    : null;
  const previous = typeof body.previous === "string" && body.previous.length < 120000 ? body.previous : null;
  save(n + 1);
  await record(s, "graphic", ask);

  const content = [
    `DATA (week of ${meta.week_start}, pulled ${meta.pulled_at}):\n${JSON.stringify(data)}`,
    report ? `REPORT ON SCREEN (computed from the same counting rules):\n${report}` : "",
    previous ? `PREVIOUS DESIGN, change it as asked and keep the rest:\n${previous}` : "",
    `REQUEST: ${ask}`,
  ].filter(Boolean).join("\n\n");

  try {
    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 24000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: brief(W, H, audience, meta.pulled_at),
      messages: [{ role: "user", content }],
    } as any);
    const msg: any = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return NextResponse.json({ error: "Claude could not make that one. Try describing it differently." }, { status: 422 });
    const text = (msg.content as any[]).filter((c) => c.type === "text").map((c) => c.text).join("");
    let svg = sanitize(text, W, H);
    if (!svg) return NextResponse.json({ error: "The design came back incomplete. Try again." }, { status: 502 });
    const base = svg; // sent back for "change this" requests, without the fonts and logo
    const fonts = await brandFontFaces();
    const logo = await logoDataUri();
    const lh = 64, lw = logo ? Math.min(380, Math.round((lh * logo.w) / logo.h)) : 0;
    svg = svg.replace(/<svg\b[^>]*>/i, (tag) => `${tag}<defs><style>${fonts}</style></defs>`);
    if (logo) svg = svg.replace(/<\/svg>\s*$/i, `<image x="56" y="52" width="${lw}" height="${lh}" href="${logo.uri}" xlink:href="${logo.uri}" preserveAspectRatio="xMinYMin meet"/></svg>`);
    return NextResponse.json({ svg, base, w: W, h: H, truncated: msg.stop_reason === "max_tokens" });
  } catch (e) {
    console.error("pulse graphic", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    const busy = e instanceof Anthropic.RateLimitError;
    return NextResponse.json({ error: busy ? "Too many requests at once. Wait a minute and try again." : "Claude could not make that one. Try again in a moment." }, { status: busy ? 429 : 502 });
  }
}
