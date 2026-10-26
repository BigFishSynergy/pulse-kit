"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addLogin, newLink, removeLogin, resetPassword, sendNewLinks, sendOneLink, setDm, type PeopleState } from "@/app/pulse/people-actions";

type Person = { u: string; name: string; role: "lead" | "rep" | "csr"; sees: string; env: boolean; dm: string; last: string; send: boolean };
/** Sending people their own sign-in links (Slack or email). on: set up in Vercel. never: how many haven't been on yet. */
type Links = { on: boolean; way: string; label: string; word: string; never: number } | null;
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

/** A one-line answer (Saved, Sent, Not sent). */
function Said({ s }: { s: PeopleState }) {
  if (s.error) return <p className="err" role="alert">{s.error}</p>;
  return s.done ? <p className="sub" role="status"><b>{s.done}</b></p> : null;
}

function Row({ p, me, links }: { p: Person; me: string; links: Links }) {
  const [pw, doPw] = useFormState<PeopleState, FormData>(resetPassword, {});
  const [ln, doLn] = useFormState<PeopleState, FormData>(newLink, {});
  const [rm, doRm] = useFormState<PeopleState, FormData>(removeLogin, {});
  const [dm, doDm] = useFormState<PeopleState, FormData>(setDm, {});
  const [sd, doSd] = useFormState<PeopleState, FormData>(sendOneLink, {});
  const said = [dm, sd].filter((x) => x.done || x.error);
  return (
    <>
      <tr>
        <td className="m">{p.name}</td><td>{p.u}</td><td>{ROLE[p.role]}</td><td className="sub">{p.sees || (p.role === "lead" ? "Everything" : "")}</td>
        <td className={p.last ? "" : "never"}>{p.last || "Never"}</td>
        {links ? (
          <td>
            <form action={doDm} className="dm" key={p.dm}><input type="hidden" name="u" value={p.u} />
              <input type="text" name="dm" defaultValue={p.dm} aria-label={`${p.name}'s ${links.word}`} placeholder={links.label === "Email" ? "name@company.com" : "U0123ABC45"} autoCapitalize="none" />
              <Go label="Save" busy="Saving" /></form>
          </td>
        ) : null}
        <td>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {links?.on && p.send ? <form action={doSd}><input type="hidden" name="u" value={p.u} /><Go label="Send link" busy="Sending" /></form> : null}
            <form action={doLn}><input type="hidden" name="u" value={p.u} /><Go label="New link" busy="Making" /></form>
            <form action={doPw}><input type="hidden" name="u" value={p.u} /><Go label="New password" busy="Making" /></form>
            {p.u !== me ? <form action={doRm} onSubmit={(e) => { if (!confirm(`Remove ${p.name}'s login? They are signed out right away.`)) e.preventDefault(); }}><input type="hidden" name="u" value={p.u} /><Go label="Remove" busy="Removing" /></form> : null}
          </div>
        </td>
      </tr>
      {[ln, pw, rm].some((x) => x.done || x.error) ? <tr className="subrow"><td colSpan={links ? 7 : 6}><Secret s={ln.done || ln.error ? ln : pw.done || pw.error ? pw : rm} /></td></tr> : null}
      {said.length ? <tr className="subrow"><td colSpan={links ? 7 : 6}>{said.map((x, i) => <Said key={i} s={x} />)}</td></tr> : null}
    </>
  );
}

export default function PeopleAdmin({ welcome, me, people, reps, csrs, links }: { welcome: boolean; me: string; people: Person[]; reps: Pick[]; csrs: Pick[]; links: Links }) {
  const [role, setRole] = useState<"lead" | "rep" | "csr">("rep");
  const [added, doAdd] = useFormState<PeopleState, FormData>(addLogin, {});
  const [sentNew, doSendNew] = useFormState<PeopleState, FormData>(sendNewLinks, {});
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
          {links ? <label>{links.label} (optional)<input type="text" name="dm" placeholder={links.label === "Email" ? "name@company.com" : "U0123ABC45"} autoCapitalize="none" /></label> : null}
          <Go label="Add" busy="Adding" />
        </form>
        <p className="sub">{role === "rep" ? "Reps come from the sales roster in the rules. A new rep shows up here after their first jobs reach the CRM." : role === "csr" ? "CSRs show up once they have set 20 appointments in 90 days." : "Leadership sees every page."}</p>
        <Secret s={added} />
      </section>
      <section>
        <h2>Everyone with a login <small>{people.length}</small></h2>
        {links?.on ? (
          <form action={doSendNew} className="sendnew">
            <button type="submit" className="btn primary" disabled={!links.never}>{links.never ? `Send their link to everyone who hasn't been on the Pulse yet (${links.never})` : "Everyone has been on the Pulse"}</button>
            <Said s={sentNew} />
          </form>
        ) : null}
        <div className="tbl">
          <table className="tight people">
            <thead><tr><th>Name</th><th>Login</th><th>Role</th><th>Sees</th><th>Last on</th>{links ? <th>{links.label}</th> : null}<th /></tr></thead>
            <tbody>{people.map((p) => <Row key={p.u} p={p} me={me} links={links} />)}</tbody>
          </table>
        </div>
        <p className="explain">New link makes a personal sign-in link (the easiest way in: they tap it once and stay signed in). New password signs that person out everywhere. Passwords and links show once and are stored only as one-way codes.</p>
        {links ? (
          <p className="explain">
            <b>Send link</b> sends that person their own sign-in link {links.way}, to the {links.word} on their row and nowhere else. Anyone can also get theirs on the sign-in page with <b>Send my link</b>.
            {links.label === "Email" ? null : <> To find someone&apos;s Slack member ID: in Slack, open their profile, tap ⋮ (More), Copy member ID.</>}
            {links.on ? null : <> Sending starts once messages are set up in Vercel (docs/SETUP.md step 12).</>}
          </p>
        ) : null}
      </section>
    </>
  );
}
