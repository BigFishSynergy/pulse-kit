"use client";
import { useState } from "react";
import { CO, CONFIG } from "@/lib/pulse/config";

// The admin writes a message, picks where it goes, sees it exactly as it will post, and confirms. The Pulse app
// posts it word for word. Nothing is sent until they press Post and confirm.

type Place = { key: string; name: string; who: string };
type Day = { key: string; time: string; title: string; about: string; to: string[] };
type Setting = { on: boolean; sampledAt?: string; lastPosted?: string };

const CH: Record<string, string> = Object.fromEntries(Object.entries(CONFIG.slack.channels ?? {}).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, v.name]));
const where = (d: Day) => d.to.map((k) => CH[k] ?? k).join(" + ");
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function SlackPost({ places, ready, daily, settings, service }: { places: Place[]; ready: boolean; daily: Day[]; settings: Record<string, Setting>; service: string }) {
  return (
    <>
      <Compose places={places} ready={ready} service={service} />
      <Daily days={daily} initial={settings} ready={ready} service={service} />
    </>
  );
}

/** The daily messages post on their own. Here the admin can pause a day, send themselves a sample, or post one now. */
function Daily({ days, initial, ready, service }: { days: Day[]; initial: Record<string, Setting>; ready: boolean; service: string }) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  async function act(action: string, day: Day, on?: boolean) {
    if (action === "daily.post" && !confirm(`Post "${day.title}" to ${where(day)} now, with the latest numbers?`)) return;
    setBusy(day.key + action); setMsg("");
    try {
      const r = await fetch("/pulse/api/slack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, day: day.key, on }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setS(j.settings);
        setMsg(action === "daily.sample" ? `Sample of "${day.title}" sent to you. Check ${service}.` : action === "daily.post" ? `"${day.title}" posted to ${where(day)}.` : `"${day.title}" is ${on ? "on" : "off"}.`);
      } else setMsg(j.error || "That did not work. Try again.");
    } catch {
      setMsg("That did not work. Check the connection and try again.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <div className="sechead">
        <h2>Daily messages to {CH.pulse ?? "Slack"} <small>These go out on their own, one a day at the time shown (local time), built fresh from the Pulse. Nothing to do here unless you want to pause one.</small></h2>
      </div>
      <div className="tbl"><table>
        <thead><tr><th>When</th><th>Message</th><th>Sample</th><th>Post now</th><th>Daily</th></tr></thead>
        <tbody>{days.map((d) => {
          const st = s[d.key] ?? { on: false };
          return (
            <tr key={d.key}>
              <td className="m">{d.time}</td>
              <td><b style={{ color: "var(--fg)" }}>{d.title}</b> <span className="sub">to {where(d)}</span><div className="sub">{d.about}</div>
                {st.lastPosted ? <div className="sub">Last posted {when(st.lastPosted)}</div> : null}</td>
              <td><button type="button" className="btn" disabled={!ready || !!busy} onClick={() => act("daily.sample", d)}>{busy === d.key + "daily.sample" ? "Sending" : "Send me a sample"}</button>
                {st.sampledAt ? <div className="sub">Sampled {when(st.sampledAt)}</div> : null}</td>
              <td><button type="button" className="btn" disabled={!ready || !!busy} onClick={() => act("daily.post", d)}>Post now</button></td>
              <td><button type="button" className={`btn ${st.on ? "primary" : ""}`} disabled={!ready || !!busy} onClick={() => act("daily.switch", d, !st.on)}
                aria-pressed={st.on}>{st.on ? "On" : "Off"}</button></td>
            </tr>
          );
        })}</tbody>
      </table></div>
      {msg ? <p className="sub">{msg}</p> : null}
      <p className="sub">On means it posts by itself at its time. Switch one off and it stops until you switch it back on.</p>
    </section>
  );
}

function Compose({ places, ready, service }: { places: Place[]; ready: boolean; service: string }) {
  const [to, setTo] = useState(places[0].key);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const place = places.find((p) => p.key === to)!;
  const body = text.trim();

  async function post() {
    if (!body || busy) return;
    if (!confirm(`Post this to ${place.name} (${place.who}), exactly as written?\n\n${body}`)) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/pulse/api/slack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", to, text: body }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setText(""); setMsg(`Posted to ${j.to} at ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`); }
      else setMsg(j.error || "That did not post. Try again.");
    } catch {
      setMsg("That did not post. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="sechead">
        <h2>Post a message <small>Posts as the {CO.pulse_name} through {service}, word for word. Only you can see this page.</small></h2>
      </div>
      {!ready ? <p className="sub">Messages are not set up yet: the {service} settings are missing in Vercel (docs/SETUP.md step 12).</p> : null}
      <div className="checks" role="radiogroup" aria-label="Where it goes">
        {places.map((p) => (
          <label key={p.key} className={`check ${to === p.key ? "on" : ""}`}>
            <input type="radio" name="to" checked={to === p.key} onChange={() => setTo(p.key)} />
            {p.name} <span className="sub">({p.who})</span>
          </label>
        ))}
      </div>
      <textarea rows={6} maxLength={3500} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your message"
        placeholder="Write it the way you want it to read. *bold* works." />
      {body ? (
        <div style={{ border: "1px solid var(--line)", padding: "12px 14px" }}>
          <div className="label" style={{ marginBottom: 6 }}>How it will post to {place.name}</div>
          <div style={{ whiteSpace: "pre-wrap", color: "var(--fg)" }}>{body}</div>
        </div>
      ) : null}
      <div className="btns">
        <button type="button" className="btn primary" disabled={!ready || !body || busy} onClick={post}>{busy ? "Posting" : `Post to ${place.name}`}</button>
      </div>
      {msg ? <p className="sub">{msg}</p> : null}
      <p className="sub">Automatic notices (requests, the Monday report, coaching cards ready, build problems) only ever DM you. A channel only gets what you post here, plus the daily messages below.</p>
    </section>
  );
}
