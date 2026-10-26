"use client";
import { useState } from "react";

// "Ask for anything": anyone signed in can ask for a new report, flag something that looks off,
// or ask for a change to the look. Leadership sees every request on the Requests page.

const KINDS = ["New report or view", "Something looks off", "Look and feel", "Other"];

export default function SuggestBox() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(KINDS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || text.trim().length < 3) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/pulse/api/requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text, page: location.pathname + location.search }),
      });
      const j = await r.json();
      if (r.ok) { setText(""); setMsg("Got it, thank you. It goes straight to leadership in Slack, and they see it on the Requests page."); }
      else setMsg(j.error || "That did not go through. Try again.");
    } catch {
      setMsg("That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="suggest-cta">
        <button type="button" className="btn" onClick={() => { setOpen(true); setMsg(""); }}>Ask for anything</button>
        <span className="sub">If you can say it, the Pulse can probably do it: a new report, a TV slide, a different look, a number that looks off. Say it in plain words. Every request gets read.</span>
      </div>
    );
  }
  return (
    <form className="suggest" onSubmit={send}>
      <div className="sechead">
        <h2>Ask for anything <small>Describe what you want in plain words. No idea is too small or too big; leadership&apos;s Claude can build most of them right into your Pulse.</small></h2>
        <button type="button" className="link" onClick={() => setOpen(false)}>Close</button>
      </div>
      <div className="checks" role="radiogroup" aria-label="Type of request">
        {KINDS.map((k) => (
          <label key={k} className={`check ${kind === k ? "on" : ""}`}>
            <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{k}
          </label>
        ))}
      </div>
      <textarea rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your request"
        placeholder="Example: show my close rate by day of the week, put the top 3 reps on the sales floor TV, or text me when a big job signs" />
      <div className="btns">
        <button type="submit" className="btn primary" disabled={busy || text.trim().length < 3}>{busy ? "Sending" : "Send"}</button>
      </div>
      {msg ? <p className="sub">{msg}</p> : null}
    </form>
  );
}
