"use client";
import { useFormState, useFormStatus } from "react-dom";
import { useEffect } from "react";
import type { LoginState } from "@/app/pulse/actions";
import { startSoundtrack, stopSoundtrack } from "./Soundtrack";
import { adminFirst, CO, CONFIG } from "@/lib/pulse/config";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? "Checking" : "Log in"}</button>;
}

export default function LoginForm({ action, title, note, next }: {
  action: (s: LoginState, f: FormData) => Promise<LoginState>; title: string; note: string; next?: string;
}) {
  const [state, formAction] = useFormState(action, {});
  useEffect(() => { if (state.error) stopSoundtrack(); }, [state]);
  return (
    <div className="login">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={CO.name} src={CONFIG.brand.logo} width={194} height={40} style={{ height: 40, width: "auto" }} />
      <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 0.95 }}>{title}</h1>
      <p className="sub">{note}</p>
      {typeof window !== "undefined" && location.search.includes("link=old") ? <p className="err">That sign-in link is no longer active. Ask {adminFirst()} for a new one, or use your name and password.</p> : null}
      <form action={formAction} onSubmit={() => startSoundtrack()}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label>Name<input type="text" name="username" autoComplete="username" autoCapitalize="none" required /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        {state.error ? <p className="err" role="alert">{state.error}</p> : null}
        <Submit />
      </form>
      <p className="sub">Got a sign-in link (it has /k/ in it)? Tap that link instead. The page you land on after it only works on a phone or computer that is already signed in, so send people the link itself.</p>
    </div>
  );
}
