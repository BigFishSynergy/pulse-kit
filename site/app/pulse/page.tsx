import { redirect } from "next/navigation";
import { getSession, homeOf, users } from "@/lib/pulse/auth";
import LoginForm from "@/components/pulse/LoginForm";
import { loginRep, sendMyLink } from "./actions";
import { canSendLinks } from "@/lib/pulse/sendlink";
import { WAY } from "@/lib/pulse/slack";
import { adminFirst, CO, CRM } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// Sales team login. The leadership login is a separate page that is never linked from here.
export default async function PulseHome() {
  if (!(await users()).length) redirect("/pulse/setup");  // a brand new Pulse: make the first login
  const s = (await getSession());
  if (s) redirect(homeOf(s.role));
  return (
    <div className="wrap">
      <LoginForm action={loginRep} linkAction={canSendLinks() ? sendMyLink : undefined} way={WAY} title="Sales Pulse" note={`Your numbers, your map and your open quotes, fresh from ${CRM} every hour.`} />
    </div>
  );
}
