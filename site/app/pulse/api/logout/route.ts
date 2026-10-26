import { NextResponse, type NextRequest } from "next/server";
import { endSession, getSession } from "@/lib/pulse/auth";

export async function POST(req: NextRequest) {
  const lead = getSession()?.role === "lead";
  endSession();
  return NextResponse.redirect(new URL(lead ? "/pulse/hq" : "/pulse", req.url), 303);
}
