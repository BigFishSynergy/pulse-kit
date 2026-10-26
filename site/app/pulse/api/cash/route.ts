import { NextResponse, type NextRequest } from "next/server";
import { getSession, VIEW_ONLY } from "@/lib/pulse/auth";
import { addCash } from "@/lib/pulse/cash";
import { pageOn } from "@/lib/pulse/config";

// The cash balance on the Scorecard. Leadership only; a view-only guest can look but not change it.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!pageOn("scorecard")) return new Response("Not found", { status: 404 });
  const s = getSession();
  if (s?.view) return NextResponse.json({ error: VIEW_ONLY }, { status: 403 });
  if (!s || s.role !== "lead") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const raw = String(b.amount ?? "").replace(/[$,\s]/g, "");
  const amount = Math.round(Number(raw));
  if (!raw || !isFinite(amount) || amount < 0 || amount > 100_000_000) return NextResponse.json({ error: "Type the balance in dollars, like 712,500." }, { status: 400 });
  const all = await addCash({ amount, at: new Date().toISOString(), by: s.u, name: s.name });
  return NextResponse.json({ ok: true, latest: all[0] });
}
