import { notFound } from "next/navigation";
import { users } from "@/lib/pulse/auth";
import SetupForm from "@/components/pulse/SetupForm";

export const dynamic = "force-dynamic";

// The first login, made in the browser: only while the Pulse has no logins at all, and only with the setup code from
// the PULSE_SETUP_CODE setting in Vercel. After that this page is a plain 404.
export default async function Setup() {
  if ((await users()).length) notFound();
  return (
    <div className="wrap">
      <SetupForm ready={(process.env.PULSE_SETUP_CODE || "").length >= 8} />
    </div>
  );
}
