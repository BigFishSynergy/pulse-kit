import "server-only";
import { createHmac } from "crypto";
import { cookies } from "next/headers";

// A soft daily cap per person for Claude features, kept in a signed cookie.
// The hard cap is the monthly spend limit set on the Anthropic API key.
export function usage(name: string, u: string) {
  const day = new Date().toISOString().slice(0, 10);
  const key = process.env.PULSE_SESSION_SECRET || "";
  const raw = cookies().get(name)?.value || "";
  const [body, mac] = raw.split(".");
  let n = 0;
  if (body && mac && createHmac("sha256", key).update(body).digest("base64url") === mac) {
    try {
      const p = JSON.parse(Buffer.from(body, "base64url").toString());
      if (p.u === u && p.d === day) n = p.n;
    } catch {}
  }
  const save = (count: number) => {
    const b = Buffer.from(JSON.stringify({ u, d: day, n: count })).toString("base64url");
    cookies().set(name, `${b}.${createHmac("sha256", key).update(b).digest("base64url")}`, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/pulse", maxAge: 86400 * 2,
    });
  };
  return { n, save };
}
