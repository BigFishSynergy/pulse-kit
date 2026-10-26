import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/pulse/auth";
import { getFacts, getRepFacts } from "@/lib/pulse/data";

export const dynamic = "force-dynamic";

// The Report Builder ledger, by role. Leadership: the whole company, or one rep with ?rep=slug.
// A rep: only their own file, whatever they ask for. CSRs have no Report Builder.
export async function GET(req: NextRequest) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (s.role === "csr") return NextResponse.json({ error: "Not available." }, { status: 403 });
  const want = req.nextUrl.searchParams.get("rep");
  const data = s.role === "lead" ? (want ? await getRepFacts(want) : await getFacts()) : await getRepFacts(s.rep!);
  if (!data) return NextResponse.json({ error: "No data yet." }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=300" } });
}
