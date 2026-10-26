"use client";
import { useRef, useState } from "react";

// A person's own sign-in link in a box, with a Copy button. Used on "You're signed in" and in the header menu.
export default function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older phones: select the text and use the old copy command.
      box.current?.select();
      try { document.execCommand("copy"); } catch {}
    }
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }
  return (
    <div className="copylink">
      <input ref={box} type="text" readOnly value={url} aria-label="Your sign-in link" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn primary" onClick={copy}>{done ? "Copied" : "Copy my link"}</button>
    </div>
  );
}
