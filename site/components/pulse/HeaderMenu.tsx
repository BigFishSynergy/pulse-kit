"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SimpleToggle, ThemeToggle } from "./ui";
import CopyLink from "./CopyLink";
import type { NavItem } from "./nav";
import { adminFirst } from "@/lib/pulse/config";

// The header's links and menus, in two parts . "tools" sits in the red band: the
// music button, a small menu (Dark mode, section options, My sign-in link, Log out) and, on phones, one Menu button that holds it
// all. "tabs" is the black bar under the band: the main pages in a row, then More. The music button is filled in by the
// Soundtrack (it lives in the layout so songs keep playing from page to page).

function Pop({ label, cls, wide, children }: { label: React.ReactNode; cls: string; wide?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div className={`pop ${cls}`} ref={box}>
      <button type="button" className="pop-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>{label}</button>
      {open ? (
        <div className={`pop-panel${wide ? " wide" : ""}`} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

const Links = ({ items }: { items: NavItem[] }) => (
  <>{items.map((n) => <Link key={n.href} href={n.href} className="mi" aria-current={n.current ? "page" : undefined}>{n.label}</Link>)}</>
);

/** The signed-in person's own sign-in link, fetched when they open it. Never anyone else's. */
function MyLink() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  async function show() {
    setOpen(!open);
    if (open || url) return;
    try {
      const r = await fetch("/pulse/api/my-link", { cache: "no-store" });
      setUrl(r.ok ? (await r.json()).url ?? null : null);
    } catch {
      setUrl(null);
    }
  }
  return (
    <>
      <button type="button" className="mi" aria-expanded={open} onClick={show}>My sign-in link</button>
      {open ? (
        <div className="mylink">
          {url === undefined ? "Getting your link" : url ? (
            <>
              <CopyLink url={url} />
              <span>Save or share this link, not the page you land on after it. This is the one that signs you in.</span>
            </>
          ) : (
            <span>No sign-in link is saved for you yet. Tap your sign-in link once (it has /k/ in it) and it shows here from then on. Lost it? Ask {adminFirst()} for a new one.</span>
          )}
        </div>
      ) : null}
    </>
  );
}

function Account({ view, options }: { view: boolean; options: boolean }) {
  return (
    <>
      <ThemeToggle />
      {options ? <SimpleToggle /> : null}
      <MyLink />
      <form action="/pulse/api/logout" method="post"><button type="submit" className="mi">Log out</button></form>
      {view ? <span className="mi-note">View only: this login can look at everything and change nothing.</span> : null}
    </>
  );
}

export default function HeaderMenus({ part, links, extras, name, view, options }: { part: "tools" | "tabs"; links: NavItem[]; extras: NavItem[]; name: string; view: boolean; options: boolean }) {
  const main = links.filter((n) => n.main), more = [...links.filter((n) => !n.main), ...extras];
  const moreOn = more.some((n) => n.current);
  if (part === "tabs") return (
    <nav className="tabs" aria-label="Pages">
      {main.map((n) => <Link key={n.href} href={n.href} aria-current={n.current ? "page" : undefined}>{n.label}</Link>)}
      {more.length ? (
        <Pop cls={`more${moreOn ? " on" : ""}`} label={<>{moreOn ? more.find((n) => n.current)!.label : "More"}<i aria-hidden>▾</i></>}>
          <Links items={more} />
        </Pop>
      ) : null}
    </nav>
  );
  return (
    <div className="hdr-r">
      <span id="rr-music" className="music-slot" />
      <Pop cls="acct" label={<>{view ? <span className="viewonly">View only</span> : name || "Menu"}<i aria-hidden>▾</i></>}>
        <Account view={view} options={options} />
      </Pop>
      <Pop cls="burger" wide label={<>Menu<i aria-hidden>▾</i></>}>
        {view ? <span className="viewonly">View only</span> : null}
        <Links items={[...main, ...more]} />
        <hr />
        <Account view={view} options={options} />
      </Pop>
    </div>
  );
}
