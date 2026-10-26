"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TZ } from "@/lib/pulse/config";

// The Ask Claude page: a full chat about the numbers or how to use the site. Every chat is saved for the person
// who had it (only them), listed on the left, and can be picked up later. Chips start a question in one tap.

type Turn = { role: "user" | "assistant"; content: string };
type Meta = { id: string; title: string; at: string; updated: string; rep?: string; n: number };
const THINK = "Thinking...";

/** Bold, bullets, numbered steps and links to pages on this site. Built as React elements, so nothing in an answer runs as HTML. */
function Lite({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [], ordered = false;
  const inline = (s: string, k: string) => s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(\/pulse\/[^)\s]*\))/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={k + i}>{p.slice(2, -2)}</strong>;
    const l = p.match(/^\[([^\]]+)\]\((\/pulse\/[^)\s]*)\)$/);
    return l ? <Link key={k + i} href={l[2]}>{l[1]}</Link> : p;
  });
  const flush = (k: number) => {
    if (list.length) out.push(ordered ? <ol key={"o" + k}>{list}</ol> : <ul key={"u" + k}>{list}</ul>);
    list = [];
  };
  text.split("\n").forEach((line, i) => {
    const b = line.match(/^\s*[-*•]\s+(.*)/), n = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (b || n) {
      if (list.length && ordered !== !!n) flush(i);
      ordered = !!n;
      list.push(<li key={i}>{inline((b ?? n)![1], "l" + i)}</li>);
    } else {
      flush(i);
      if (line.trim()) out.push(<p key={i}>{inline(line.replace(/^#+\s*/, ""), "p" + i)}</p>);
    }
  });
  flush(-1);
  return <>{out}</>;
}

const when = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
};

function pick(chips: [string, string][], n: number) {
  return chips.slice().sort(() => Math.random() - 0.5).slice(0, n);
}

export default function AskPage({ scope, ask, help, reps, week, initialQ, initialRep }: {
  scope: "lead" | "rep"; ask: [string, string][]; help: [string, string][];
  reps?: [string, string][]; week?: string; initialQ?: string; initialRep?: string;
}) {
  const [chats, setChats] = useState<Meta[]>([]);
  const [id, setId] = useState<string | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [rep, setRep] = useState(initialRep ?? "");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [shown, setShown] = useState<[string, string][]>(ask.slice(0, 4));
  const [helpShown, setHelpShown] = useState<[string, string][]>(help.slice(0, 3));
  const ctl = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const repName = (slug?: string) => reps?.find((r) => r[0] === slug)?.[1];

  const loadList = () => fetch("/pulse/api/chats").then((r) => r.json()).then((j) => setChats(j.chats ?? [])).catch(() => {});
  const shuffle = () => { setShown(pick(ask, 4)); setHelpShown(pick(help, 3)); };

  useEffect(() => {
    shuffle();
    loadList();
    if (initialQ && !started.current) {
      started.current = true;
      send(initialQ, [], undefined);
      // drop ?q= so a refresh does not ask it again
      const u = new URL(window.location.href); u.searchParams.delete("q"); window.history.replaceState(null, "", u.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [turns]);

  function fresh() {
    if (busy) return;
    setId(undefined); setTurns([]); setQ(""); setNote(""); shuffle();
  }

  async function open(cid: string) {
    if (busy || cid === id) return;
    setNote("");
    const j = await fetch(`/pulse/api/chats?id=${cid}`).then((r) => r.json()).catch(() => ({}));
    if (!j.chat) { setNote(j.error || "Could not open that chat."); loadList(); return; }
    setId(j.chat.id); setTurns(j.chat.turns); setRep(j.chat.rep ?? "");
  }

  async function remove(cid: string) {
    if (busy || !window.confirm("Delete this chat? This cannot be undone.")) return;
    await fetch(`/pulse/api/chats?id=${cid}`, { method: "DELETE" }).catch(() => {});
    if (cid === id) fresh();
    loadList();
  }

  async function send(question: string, before = turns, chatId = id) {
    question = question.trim();
    if (!question || busy) return;
    const history = before.filter((t) => t.content !== THINK).slice(-8);
    setTurns([...before, { role: "user", content: question }, { role: "assistant", content: THINK }]);
    setQ(""); setNote(""); setBusy(true);
    ctl.current = new AbortController();
    let text = "", ok = false;
    const show = (t: string) => setTurns((ts) => [...ts.slice(0, -1), { role: "assistant", content: t }]);
    try {
      const res = await fetch("/pulse/api/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, week, rep: scope === "lead" && rep ? rep : undefined }),
        signal: ctl.current.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        show(j.error || "Claude could not answer that one. Try again in a moment.");
        return;
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        show(text);
      }
      ok = !!text.trim();
      if (!ok) show("Claude could not answer that one. Try again in a moment.");
    } catch (e) {
      show(text || ((e as Error).name === "AbortError" ? "Stopped." : "Claude could not answer that one. Try again in a moment."));
      ok = !!text.trim();
    } finally {
      setBusy(false);
    }
    if (!ok) return;
    const all = [...before, { role: "user" as const, content: question }, { role: "assistant" as const, content: text }];
    const j = await fetch("/pulse/api/chats", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: chatId, rep: scope === "lead" && rep ? rep : undefined, turns: all }),
    }).then((r) => r.json()).catch(() => ({}));
    if (j.id) { setId(j.id); loadList(); } else setNote("This answer could not be saved. It is still on screen.");
  }

  const empty = !turns.length;
  return (
    <div className="askpage">
      <aside className="chatlist" aria-label="Your saved chats">
        <button type="button" className="btn primary" onClick={fresh} disabled={busy}>New chat</button>
        <span className="label">Your chats <span className="sub">only you can see these</span></span>
        {chats.length ? (
          <ul>
            {chats.map((c) => (
              <li key={c.id} className={c.id === id ? "on" : ""}>
                <button type="button" className="open" onClick={() => open(c.id)} disabled={busy}>
                  <span className="t">{c.title}</span>
                  <span className="sub">{when(c.updated)}{c.rep && repName(c.rep) ? ` · ${repName(c.rep)}` : ""}</span>
                </button>
                <button type="button" className="x" onClick={() => remove(c.id)} aria-label={`Delete chat: ${c.title}`} disabled={busy}>×</button>
              </li>
            ))}
          </ul>
        ) : <p className="sub">No saved chats yet. Ask something and it lands here.</p>}
      </aside>

      <section className="chatmain" aria-label="Ask Claude">
        {scope === "lead" && reps?.length ? (
          <label className="chan">Numbers for
            <select value={rep} onChange={(e) => setRep(e.target.value)} disabled={busy}>
              <option value="">The whole company</option>
              {reps.map(([slug, name]) => <option key={slug} value={slug}>{name}&apos;s screen</option>)}
            </select>
          </label>
        ) : null}

        {empty ? (
          <div className="askintro">
            <h2>Ask Claude <small>{scope === "lead" ? "About the numbers, or how to use anything on the Pulse" : "About your numbers, or how to use anything on your screen"}</small></h2>
            <div className="chipgroup">
              <span className="label">About the numbers</span>
              <div className="chips">{shown.map(([l, full]) => <button key={l} type="button" onClick={() => send(full)} disabled={busy}>{l}</button>)}</div>
            </div>
            <div className="chipgroup">
              <span className="label">Using the site</span>
              <div className="chips">{helpShown.map(([l, full]) => <button key={l} type="button" onClick={() => send(full)} disabled={busy}>{l}</button>)}</div>
            </div>
            <button type="button" className="link" onClick={shuffle} disabled={busy}>More ideas</button>
          </div>
        ) : (
          <div className="asklog" ref={logRef} aria-live="polite">
            {turns.map((t, i) => (t.role === "user" ? <div key={i} className="q">{t.content}</div> : <div key={i} className="a"><Lite text={t.content} /></div>))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="askform">
          <label htmlFor="ask-q" className="visually-hidden">Your question</label>
          <textarea id="ask-q" rows={2} maxLength={800} value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(q); } }}
            placeholder={scope === "lead" ? "Ask anything. Example: why is revenue behind pace this quarter? Or: how do I build a report by county?" : "Ask anything. Example: where do I close best? Or: how do I make a graphic?"} />
          <div className="btns">
            <button type="submit" className="btn primary" disabled={busy}>Ask</button>
            {busy ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Stop</button> : null}
          </div>
        </form>
        {note ? <p className="sub">{note}</p> : null}
        <p className="sub">Answers come from this week&apos;s numbers, counted with the company&apos;s rules. Claude can be wrong, so check anything important on the page itself.</p>
      </section>
    </div>
  );
}

/** The Ask Claude box on the Pulse and rep screens: a few one-tap questions and a box that opens the Ask page. */
export function AskTeaser({ href, ask, help, title, note }: { href: string; ask: [string, string][]; help: [string, string][]; title: string; note: string }) {
  const [shown, setShown] = useState<[string, string][]>(ask.slice(0, 3));
  const [helpShown, setHelpShown] = useState<[string, string][]>(help.slice(0, 2));
  const [q, setQ] = useState("");
  useEffect(() => { setShown(pick(ask, 3)); setHelpShown(pick(help, 2)); }, [ask, help]);
  const go = (question: string) => `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(question)}`;
  return (
    <section className="askteaser" aria-label="Ask Claude">
      <div className="head">
        <h2>{title} <small>{note}</small></h2>
        <Link href={href} className="btn primary">Open Ask Claude</Link>
      </div>
      <div className="chips">
        {shown.map(([l, full]) => <Link key={l} href={go(full)} className="chip">{l}</Link>)}
        {helpShown.map(([l, full]) => <Link key={l} href={go(full)} className="chip how">{l}</Link>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) window.location.href = go(q.trim()); }} className="askform row">
        <label htmlFor="teaser-q" className="visually-hidden">Your question</label>
        <input id="teaser-q" type="text" maxLength={800} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question and press Enter" />
        <button type="submit" className="btn">Ask</button>
      </form>
    </section>
  );
}
