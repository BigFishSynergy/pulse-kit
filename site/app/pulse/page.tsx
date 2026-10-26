import { redirect } from "next/navigation";
import { getSession, homeOf } from "@/lib/pulse/auth";
import LoginForm from "@/components/pulse/LoginForm";
import { loginRep } from "./actions";
import { adminFirst, CO, CRM } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// Sales team login. The leadership login is a separate page that is never linked from here.
export default function PulseHome() {
  const s = getSession();
  if (s) redirect(homeOf(s.role));
  return (
    <div className="wrap">
      <LoginForm action={loginRep} title="Sales Pulse" note={`Your numbers, your map and your open quotes, fresh from ${CRM} every hour.`} />
    </div>
  );
}
