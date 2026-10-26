import { redirect } from "next/navigation";
import { getSession, safeNext } from "@/lib/pulse/auth";
import LoginForm from "@/components/pulse/LoginForm";
import { loginLead } from "../actions";

export const dynamic = "force-dynamic";

// Leadership login. Rep logins do not work here.
export default function LeadLogin({ searchParams }: { searchParams: { next?: string } }) {
  const next = safeNext(searchParams.next);
  if (getSession()?.role === "lead") redirect(next ?? "/pulse/hq/pulse");
  return (
    <div className="wrap">
      <LoginForm action={loginLead} title="Pulse" note="Leadership view." next={next ?? undefined} />
    </div>
  );
}
