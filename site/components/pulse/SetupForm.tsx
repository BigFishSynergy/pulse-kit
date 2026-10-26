"use client";
import { useFormState, useFormStatus } from "react-dom";
import { setupFirst, type PeopleState } from "@/app/pulse/people-actions";
import { CO, CONFIG } from "@/lib/pulse/config";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? "Setting up" : "Create my login"}</button>;
}

export default function SetupForm({ ready }: { ready: boolean }) {
  const [state, action] = useFormState<PeopleState, FormData>(setupFirst, {});
  return (
    <div className="login">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={CO.name} src={CONFIG.brand.logo} width={194} height={40} style={{ height: 40, width: "auto" }} />
      <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 0.95 }}>Welcome</h1>
      <p className="sub">Make the first login for the {CO.pulse_name}. It becomes the admin login, <b>{CONFIG.people.admin}</b>, who adds everyone else on the People page.</p>
      {ready ? (
        <form action={action}>
          <label>Setup code<input type="password" name="code" autoComplete="off" required /></label>
          <label>Your full name<input type="text" name="name" autoComplete="name" required /></label>
          <label>Pick a password (10 or more characters)<input type="password" name="password" autoComplete="new-password" minLength={10} required /></label>
          {state.error ? <p className="err" role="alert">{state.error}</p> : null}
          <Submit />
        </form>
      ) : (
        <p className="err">Almost there. In Vercel, add the setting PULSE_SETUP_CODE (any 8 or more characters you make up), redeploy, and come back to this page.</p>
      )}
      <p className="sub">The setup code is the one you typed into Vercel yourself. This page only works once, before any logins exist.</p>
    </div>
  );
}
