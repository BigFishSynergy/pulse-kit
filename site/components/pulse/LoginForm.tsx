"use client";
import { useFormState, useFormStatus } from "react-dom";
import { useEffect } from "react";
import type { LinkState, LoginState } from "@/app/pulse/actions";
import { startSoundtrack, stopSoundtrack } from "./Soundtrack";
import { adminFirst, CO, CONFIG } from "@/lib/pulse/config";

function SendLink({ way }: { way: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? "Sending" : `Send my link ${way}`}</button>;
}

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? "Checking" : "Log in"}</button>;
}

// linkAction and way: "Lost your sign-in link?", when the Pulse can send people their own link (Slack or email).
const noLink = async (s: LinkState) => s;

export default function LoginForm({ action, linkAction, way = "", title, note, next }: {
  action: (s: LoginState, f: FormData) => Promise<LoginState>; linkAction?: (s: LinkState, f: FormData) => Promise<LinkState>; way?: string;
  title: string; note: string; next?: string;
}) {
  const [state, formAction] = useFormState(action, {});
  const [linkState, linkFormAction] = useFormState(linkAction ?? noLink, {});
  useEffect(() => { if (state.error) stopSoundtrack(); }, [state]);
  return (
    <div className="login">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={CO.name} src={CONFIG.brand.logo} width={194} height={40} style={{ height: 40, width: "auto" }} />
      <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 0.95 }}>{title}</h1>
      <p className="sub">{note}</p>
      {typeof window !== "undefined" && location.search.includes("link=old") ? <p className="err">That sign-in link is no longer active. {linkAction ? `Get your current one with Send my link ${way} below` : `Ask ${adminFirst()} for a new one`}, or use your name and password.</p> : null}
      <form action={formAction} onSubmit={() => startSoundtrack()}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label>Name<input type="text" name="username" autoComplete="username" autoCapitalize="none" required /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        {state.error ? <p className="err" role="alert">{state.error}</p> : null}
        <Submit />
      </form>
      {linkAction ? (
        <form action={linkFormAction} className="getlink">
          <p className="sub"><b>Lost your sign-in link?</b> Type your name and the Pulse sends your own link to you {way}.</p>
          <label>Name<input type="text" name="username" autoComplete="username" autoCapitalize="none" required /></label>
          {linkState.done ? <p className="sub" role="status">{linkState.done}</p> : null}
          <SendLink way={way} />
        </form>
      ) : null}
      <p className="sub">Got a sign-in link (it has /k/ in it)? Tap that link instead. The page you land on after it only works on a phone or computer that is already signed in, so send people the link itself.</p>
    </div>
  );
}
