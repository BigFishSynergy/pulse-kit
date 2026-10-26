"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addScreen, newScreenLink, removeScreen, type TvState } from "@/app/pulse/tv-actions";

type Slide = { key: string; title: string; about: string; office?: boolean };
type Screen = { id: string; name: string; audience: "floor" | "office"; slides: string[]; seconds: number; dark: boolean };

function Go({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary" disabled={pending}>{pending ? busy : label}</button>;
}

function Result({ s }: { s: TvState }) {
  if (s.error) return <p className="err" role="alert">{s.error}</p>;
  if (!s.done) return null;
  return (
    <div className="state" style={{ gap: 8 }}>
      <p><b>{s.done}</b></p>
      {s.link ? <>
        <p className="sub">On the TV, open its web browser, go to this link, then press full screen (F11, or the browser&apos;s full screen option). It signs the TV in by itself, stays on, and refreshes every 10 minutes.</p>
        <p><code>{s.link}</code> <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(s.link!)}>Copy</button></p>
        <p className="sub">This link shows once. Anyone with it can see this TV&apos;s slides, so type it into the TV yourself rather than posting it anywhere.</p>
      </> : null}
    </div>
  );
}

/** "Set up a TV": four questions, one at a time. */
function Wizard({ slides, onDone }: { slides: Slide[]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [aud, setAud] = useState<"floor" | "office">("floor");
  const [pick, setPick] = useState<string[]>(["week", "power", "leaders"]);
  const [secs, setSecs] = useState(15);
  const [state, action] = useFormState<TvState, FormData>(addScreen, {});
  const allowed = slides.filter((s) => aud === "office" || !s.office);
  const toggle = (k: string) => setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  if (state.done) return <><Result s={state} /><button type="button" className="btn" onClick={onDone}>Done</button></>;
  return (
    <form action={action} className="tvwiz" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="name" value={name} /><input type="hidden" name="audience" value={aud} /><input type="hidden" name="seconds" value={secs} />
      {pick.filter((k) => allowed.some((s) => s.key === k)).map((k) => <input key={k} type="hidden" name="slides" value={k} />)}
      <p className="sub">Question {step + 1} of 4</p>
      {step === 0 ? <label>Where does this TV hang?<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales floor" autoFocus /></label> : null}
      {step === 1 ? <fieldset style={{ border: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend>Who walks past it?</legend>
        <label><input type="radio" checked={aud === "floor"} onChange={() => setAud("floor")} /> The whole team (sales floor). Wins, leaderboards and goals. No margins, cash or money owed.</label>
        <label><input type="radio" checked={aud === "office"} onChange={() => setAud("office")} /> Leadership only (a private office). Everything, including the scorecard and money.</label>
      </fieldset> : null}
      {step === 2 ? <fieldset style={{ border: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend>Which slides should it show? It rotates through them in this order.</legend>
        {allowed.map((s) => <label key={s.key}><input type="checkbox" checked={pick.includes(s.key)} onChange={() => toggle(s.key)} /> <b>{s.title}</b> <span className="sub">{s.about}</span></label>)}
      </fieldset> : null}
      {step === 3 ? <label>How long should each slide stay up?
        <select value={secs} onChange={(e) => setSecs(Number(e.target.value))}>{[10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}</select>
        <span className="sub">The numbers refresh on their own every 10 minutes, whatever you pick.</span></label> : null}
      <Result s={state} />
      <div style={{ display: "flex", gap: 8 }}>
        {step > 0 ? <button type="button" className="btn" onClick={() => setStep(step - 1)}>Back</button> : null}
        {step < 3 ? <button type="button" className="btn primary" disabled={(step === 0 && !name.trim()) || (step === 2 && !pick.some((k) => allowed.some((s) => s.key === k)))} onClick={() => setStep(step + 1)}>Next</button>
          : <Go label="Make the TV link" busy="Making" />}
      </div>
    </form>
  );
}

function Row({ s, slides }: { s: Screen; slides: Slide[] }) {
  const [ln, doLn] = useFormState<TvState, FormData>(newScreenLink, {});
  const [rm, doRm] = useFormState<TvState, FormData>(removeScreen, {});
  return (
    <>
      <tr>
        <td className="m">{s.name}</td><td>{s.audience === "office" ? "Leadership" : "Whole team"}</td>
        <td className="sub">{s.slides.map((k) => slides.find((x) => x.key === k)?.title ?? k).join(", ")}</td><td>{s.seconds}s</td>
        <td><div style={{ display: "flex", gap: 6 }}>
          <form action={doLn}><input type="hidden" name="id" value={s.id} /><button className="btn" type="submit">New link</button></form>
          <form action={doRm} onSubmit={(e) => { if (!confirm(`Remove ${s.name}? Its link stops working.`)) e.preventDefault(); }}><input type="hidden" name="id" value={s.id} /><button className="btn" type="submit">Remove</button></form>
        </div></td>
      </tr>
      {ln.done || ln.error || rm.error ? <tr className="subrow"><td colSpan={5}><Result s={ln.done || ln.error ? ln : rm} /></td></tr> : null}
    </>
  );
}

export default function TvSetup({ slides, screens }: { slides: Slide[]; screens: Screen[] }) {
  const [open, setOpen] = useState(screens.length === 0);
  const [n, setN] = useState(0); // a fresh wizard each time, kept across the page refresh that follows a new TV
  return (
    <>
      <section>
        <div className="sechead"><h2>TV screens <small>Put the Pulse on a TV in the office. Each TV gets its own link and its own slides.</small></h2>
          {!open ? <button type="button" className="btn primary" onClick={() => setOpen(true)}>Set up a TV</button> : null}</div>
        {open ? <Wizard key={n} slides={slides} onDone={() => { setOpen(false); setN(n + 1); }} /> : null}
      </section>
      {screens.length ? <section>
        <h2>Your TVs</h2>
        <div className="tbl"><table className="tight"><thead><tr><th>TV</th><th>Who sees it</th><th>Slides</th><th>Each</th><th /></tr></thead>
          <tbody>{screens.map((s) => <Row key={s.id} s={s} slides={slides} />)}</tbody></table></div>
        <p className="explain">To change what a TV shows, remove it and set it up again; it gets a new link. A smart TV&apos;s own web browser works, or a small streaming stick or laptop plugged into the TV.</p>
      </section> : null}
    </>
  );
}
