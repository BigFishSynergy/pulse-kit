import { NextResponse, type NextRequest } from "next/server";
import { getSession, VIEW_ONLY } from "@/lib/pulse/auth";
import { deleteChat, getChat, listChats, saveChat } from "@/lib/pulse/chats";
import { pageOn } from "@/lib/pulse/config";

// Saved Ask Claude chats. Each person only ever reads, saves or deletes their own.
export const dynamic = "force-dynamic";

const noAsk = (role: string) => role === "csr" || (role === "rep" && process.env.PULSE_ASK_REPS !== "on");

export async function GET(req: NextRequest) {
  if (!pageOn("ask_claude")) return new Response("Not found", { status: 404 });
  const s = getSession();
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (s.view) return NextResponse.json({ chats: [] });
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const c = await getChat(s.u, id);
    return c ? NextResponse.json({ chat: c }) : NextResponse.json({ error: "That chat is gone." }, { status: 404 });
  }
  return NextResponse.json({ chats: await listChats(s.u) });
}

export async function POST(req: NextRequest) {
  if (!pageOn("ask_claude")) return new Response("Not found", { status: 404 });
  const s = getSession();
  if (s?.view) return NextResponse.json({ error: VIEW_ONLY }, { status: 403 });
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (noAsk(s.role)) return NextResponse.json({ error: "Ask Claude is not switched on for the sales team yet." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!Array.isArray(b.turns) || !b.turns.length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  // a rep's chats are always about their own numbers; leadership may pin a chat to one rep's screen
  const rep = s.role === "lead" && typeof b.rep === "string" && /^[a-z0-9-]{1,60}$/.test(b.rep) ? b.rep : undefined;
  const id = await saveChat(s.u, { id: typeof b.id === "string" ? b.id : undefined, rep, turns: b.turns });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  if (!pageOn("ask_claude")) return new Response("Not found", { status: 404 });
  const s = getSession();
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const ok = await deleteChat(s.u, req.nextUrl.searchParams.get("id") ?? "");
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not delete that chat." }, { status: 400 });
}
