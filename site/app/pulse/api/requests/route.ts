import { NextResponse, type NextRequest } from "next/server";
import { getSession, VIEW_ONLY } from "@/lib/pulse/auth";
import { addRequest, listRequests, setStatus, type Status } from "@/lib/pulse/requests";
import { dmAdmin, postApproved } from "@/lib/pulse/slack";
import { usage } from "@/lib/pulse/usage";
import { record } from "@/lib/pulse/activity";
import { CO, CONFIG } from "@/lib/pulse/config";
import { pageOn } from "@/lib/pulse/config";

// Improvement requests. Anyone signed in can send one; leadership can list them and set a status.
export const dynamic = "force-dynamic";

const KINDS = ["New report or view", "Something looks off", "Look and feel", "Other"];
const ROLE = { lead: "Leadership", csr: "CSR", rep: "Sales" } as const;

// The request in their own words for the Pulse Slack channel (pulse.config.json slack.requests_channel), with phone numbers and emails masked and nothing
// Slack would turn into a link or a mention.
function forSlack(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .split("\n").map((l) => `> ${l}`).join("\n");
}
const STATUSES: Status[] = ["new", "planned", "done", "not_now"];

export async function POST(req: NextRequest) {
  if (!pageOn("requests")) return new Response("Not found", { status: 404 });
  const s = (await getSession());
  if (s?.view) return NextResponse.json({ error: VIEW_ONLY }, { status: 403 });
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, 2000);
  if (text.length < 3) return NextResponse.json({ error: "Tell us a little more first." }, { status: 400 });
  const kind = KINDS.includes(b.kind) ? b.kind : "Other";
  const page = String(b.page || "").replace(/[^\w/#?=&.-]/g, "").slice(0, 200);
  const { n, save } = usage("rr_req", s.u);
  if (n >= 20) return NextResponse.json({ error: "That is plenty for today. Thank you!" }, { status: 429 });
  const r = await addRequest({ who: s.u, name: s.name, role: s.role, kind, text, page });
  save(n + 1);
  await record(s, "request");
  // The requests channel gets the request word for word; if Slack won't take it there, the admin gets a DM instead.
  const posted = await postApproved(CONFIG.slack.requests_channel || "pulse", `:bulb: *New Pulse request* from ${s.name} (${ROLE[s.role]}) · ${kind}\n${forSlack(text)}`);
  if (!posted.ok) await dmAdmin(`:bulb: New Pulse request from ${s.name} (${kind}). Read it: ${CO.site_url.replace(/\/$/, "")}/pulse/hq/requests`);
  return NextResponse.json({ ok: true, id: r.id });
}

export async function GET() {
  if (!pageOn("requests")) return new Response("Not found", { status: 404 });
  const s = (await getSession());
  if (!s || s.role !== "lead") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return NextResponse.json({ requests: await listRequests() });
}

export async function PATCH(req: NextRequest) {
  if (!pageOn("requests")) return new Response("Not found", { status: 404 });
  const s = (await getSession());
  if (s?.view) return NextResponse.json({ error: VIEW_ONLY }, { status: 403 });
  if (!s || s.role !== "lead") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "Bad status." }, { status: 400 });
  const r = await setStatus(String(b.id || ""), b.status, typeof b.note === "string" ? b.note : undefined);
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, request: r });
}
