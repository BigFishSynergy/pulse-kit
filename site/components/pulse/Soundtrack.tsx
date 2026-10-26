"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { logActivity } from "./ActivityBeacon";

// The soundtrack (optional, pulse.config.json pages.soundtrack): a random shuffle of the songs the company put in the
// private Blob store's music/ folder (music/index.json lists them; the company must own the rights), audio only.
// It starts on the Log in click (or on the first tap for someone already signed in, since browsers only allow
// sound after a tap), keeps playing while people move around the site, and has a small button to skip or turn
// it off. "Off" is remembered on each device. The songs stream from /pulse/api/music, which checks the login.
// The button sits in the header. This component stays in
// the layout so the music keeps going between pages; it draws its button into the header's #rr-music spot.

type Track = { id: string; title: string; artist: string };

const pref = () => { try { return localStorage.getItem("rr.music") || "on"; } catch { return "on"; } };
const setPref = (v: string) => { try { localStorage.setItem("rr.music", v); } catch {} };

export function startSoundtrack() {
  window.dispatchEvent(new Event("rr-music-start"));
}
export function stopSoundtrack() {
  window.dispatchEvent(new Event("rr-music-stop"));
}

function shuffle<T>(a: T[]) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export default function Soundtrack({ signedIn }: { signedIn: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<Track[]>([]);
  const [now, setNow] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tracks, setTracks] = useState<Track[] | null>(null);

  // Make the audio element right away and press play inside the click itself, so the browser allows sound.
  function ensureAudio() {
    if (!audio.current) {
      const a = new Audio();
      a.preload = "auto";
      a.volume = 0.55;
      a.addEventListener("ended", () => next());
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("error", () => next());
      audio.current = a;
    }
    return audio.current;
  }
  function next(list = tracks) {
    if (!list?.length) return;
    if (!queue.current.length) queue.current = shuffle(list);
    const t = queue.current.shift()!;
    const a = ensureAudio();
    a.src = `/pulse/api/music/${t.id}`;
    setNow(t);
    a.play().catch(() => setPlaying(false));
  }
  async function start() {
    if (pref() === "off") return;
    const a = ensureAudio();
    if (a.src && a.paused) { a.play().catch(() => {}); return; }
    if (a.src) return;
    // Unlock audio during the click with a silent play, then load the list.
    a.src = "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";
    a.play().catch(() => {});
    const list = tracks ?? (await fetch("/pulse/api/music").then((r) => (r.ok ? r.json() : { tracks: [] })).then((j) => j.tracks as Track[]).catch(() => []));
    if (!tracks) setTracks(list);
    next(list);
    logActivity({ kind: "music" });
  }

  useEffect(() => {
    const onStart = () => start();
    const onStop = () => audio.current?.pause();
    window.addEventListener("rr-music-start", onStart);
    window.addEventListener("rr-music-stop", onStop);
    const first = () => { window.removeEventListener("pointerdown", first, true); if (signedIn && !audio.current && !document.querySelector("[data-no-soundtrack]")) start(); };
    if (signedIn) window.addEventListener("pointerdown", first, true);
    return () => { window.removeEventListener("rr-music-start", onStart); window.removeEventListener("rr-music-stop", onStop); window.removeEventListener("pointerdown", first, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const path = usePathname();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Find the header's spot. A new page's header can arrive a moment after the address changes, so watch for it.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    let cur: HTMLElement | null = null;
    const find = () => { const el = document.getElementById("rr-music"); if (el !== cur) { cur = el; setSlot(el); } };
    find();
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); document.removeEventListener("keydown", key); };
  }, [open]);

  if (!signedIn && !now) return null;
  if (tracks && !tracks.length) return null;
  if (!slot || !slot.isConnected) return null;
  const off = () => { audio.current?.pause(); setPref("off"); setOpen(false); };
  const on = () => { setPref("on"); start(); };
  const live = playing && now;
  return createPortal(
    <div className={`soundtrack${live ? " on" : ""}`} ref={box}>
      <button type="button" className="st-btn" aria-expanded={open} aria-label={live ? `Soundtrack: playing ${now.title}` : "Soundtrack"} title="Soundtrack" onClick={() => setOpen(!open)}>
        {live ? <span className="st-eq" aria-hidden><i /><i /><i /></span> : <span aria-hidden>♪</span>}
      </button>
      {open ? (
        <div className="pop-panel st-panel">
          <span className="st-head">Soundtrack</span>
          {live ? <><span className="st-title">{now.title}</span><span className="st-artist">{now.artist}</span></> : <span className="st-artist">Off right now.</span>}
          <span className="st-btns">
            {live ? (
              <>
                <button type="button" className="mi" onClick={() => next()}>Shuffle to another song</button>
                <button type="button" className="mi" onClick={off}>Turn it off</button>
              </>
            ) : <button type="button" className="mi" onClick={on}>Play</button>}
          </span>
        </div>
      ) : null}
    </div>,
    slot,
  );
}
