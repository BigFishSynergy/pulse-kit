"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addLogin, newLink, removeLogin, resetPassword, type PeopleState } from "@/app/pulse/people-actions";

type Person = { u: string; name: string; role: "lead" | "rep" | "csr"; sees: string; env: boolean };
type Pick = { name: string; slug: string };
const ROLE = { lead: "Leadership", rep: "Sales rep", csr: "CSR (setter)" };

function Go({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? busy : label}</button>;
}

/** The one-time password or link, with a copy button. Shown once; it can't be shown again later. */
function Secret({ s }: { s: PeopleState }) {
  if (s.error) return <p className="err" role="alert">{s.error}</p>;
  if (!s.done) return null;
  const copy = (t: string) => navigator.clipboard?.writeText(t);
  return (
    <div className="state" style={{ gap: 8 }}>
      <p><b>{s.done}</b></p>
      {s.link ? <p className="sub">Sign-in link for <b>{s.who}</b> (send it to them directly; tapping it signs them in): <code>{s.link}</code> <button type="button" className="btn" onClick={() => copy(s.link!)}>Copy</button></p> : null}
      {s.password ? <p className="sub">Password for <b>{s.who}</b>: <code>{s.password}</code> <button type="button" className="btn" onClick={() => copy(s.password!)}>Copy</button></p> : null}
      {s.link || s.password ? <p className="sub">This shows once. Hand it over in person or by text to that person only, never in a group chat or email thread.</p> : null}
    </div>
  );
}

function Row({ p, me }: { p: Person; me: string }) {
  const [pw, doPw] = useFormState<PeopleState, FormData>(resetPassword, {});
  const [ln, doLn] = useFormState<PeopleState, FormData>(newLink, {});
  const [rm, doRm] = useFormState<PeopleState, FormData>(removeLogin, {});
  return (
    <>
      <tr>
        <td className="m">{p.name}</td><td>{p.u}</td><td>{ROLE[p.role]}</td><td className="sub">{p.sees || (p.role === "lead" ? "Everything" : "")}</td>
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <form action={doLn}><input type="hidden" name="u" value={p.u} /><Go label="New link" busy="Making" /></form>
            <form action={doPw}><input type="hidden" name="u" value={p.u} /><Go label="New password" busy="Making" /></form>
            {p.u !== me ? <form action={doRm} onSubmit={(e) => { if (!confirm(`Remove ${p.name}'s login? They are signed out right away.`)) e.preventDefault(); }}><input type="hidden" name="u" value={p.u} /><Go label="Remove" busy="Removing" /></form> : null}
          </div>
        </td>
      </tr>
      {[ln, pw, rm].some((x) => x.done || x.error) ? <tr className="subrow"><td colSpan={5}><Secret s={ln.done || ln.error ? ln : pw.done || pw.error ? pw : rm} /></td></tr> : null}
    </>
  );
}

export default function PeopleAdmin({ welcome, me, people, reps, csrs }: { welcome: boolean; me: string; people: Person[]; reps: Pick[]; csrs: Pick[] }) {
  const [role, setRole] = useState<"lead" | "rep" | "csr">("rep");
  const [added, doAdd] = useFormState<PeopleState, FormData>(addLogin, {});
  const picks = role === "rep" ? reps : role === "csr" ? csrs : [];
  return (
    <>
      {welcome ? <section className="state"><h2>You&apos;re in</h2><p className="sub">This is the People page. Add each person who should see the Pulse. Reps only ever see their own numbers; leadership sees everything.</p></section> : null}
      <section>
        <h2>Add someone</h2>
        <form action={doAdd} className="people-add" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
          <label>Role<select name="role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="rep">Sales rep</option><option value="csr">CSR (setter)</option><option value="lead">Leadership</option></select></label>
          {role !== "lead" ? (
            <label>{role === "rep" ? "Their numbers" : "Their appointments"}<select name="slug" required defaultValue="">
              <option value="" disabled>Pick a name</option>
              {picks.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select></label>
          ) : null}
          <label>Full name<input type="text" name="name" required /></label>
          <label>Login name<input type="text" name="u" placeholder="alex" autoCapitalize="none" required /></label>
          <Go label="Add" busy="Adding" />
        </form>
        <p className="sub">{role === "rep" ? "Reps come from the sales roster in the rules. A new rep shows up here after their first jobs reach the CRM." : role === "csr" ? "CSRs show up once they have set 20 appointments in 90 days." : "Leadership sees every page."}</p>
        <Secret s={added} />
      </section>
      <section>
        <h2>Everyone with a login <small>{people.length}</small></h2>
        <div className="tbl">
          <table className="tight">
            <thead><tr><th>Name</th><th>Login</th><th>Role</th><th>Sees</th><th /></tr></thead>
            <tbody>{people.map((p) => <Row key={p.u} p={p} me={me} />)}</tbody>
          </table>
        </div>
        <p className="explain">New link makes a personal sign-in link (the easiest way in: they tap it once and stay signed in). New password signs that person out everywhere. Passwords and links show once and are stored only as one-way codes.</p>
      </section>
    </>
  );
}
