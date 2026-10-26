import HeaderMenus from "./HeaderMenu";
import type { NavItem } from "./nav";
import { getSession, isAdmin } from "@/lib/pulse/auth";
import { CO, CONFIG, CRM, pageOn } from "@/lib/pulse/config";
import type { Meta } from "@/lib/pulse/data";

// The header on every signed-in page: a band in the company's primary color (pulse.config.json brand.colors) with a dark
// rule under it, holding the logo, the page title, a chip in the accent color saying when the CRM data was pulled, a
// quarter chip, the music (when the soundtrack page is on) and a small menu (dark mode, Log out). Under it a dark tab
// bar with the main pages and More, a line under the page you're on. On a phone the band is the logo and two buttons,
// and the title sits under it. `children` sit at the right of the row under the header (the Clean / Everything switch).
export default function Header({ title, meta, hoursOld, nav, options, children }: {
  title: string; meta: Meta | null; hoursOld: number | null; nav: NavItem[];
  /** Kept so older pages that pass it still compile. */
  trial?: boolean;
  /** This page has sections whose option buttons fold away, so the menu offers to show them all. */
  options?: boolean;
  children?: React.ReactNode;
}) {
  const stale = hoursOld != null && hoursOld > 24;
  const session = getSession();
  const view = !!session?.view;
  const links = view ? nav.filter((n) => !/\/hq\/(ask|game|requests|activity)\b/.test(n.href)) : nav;
  // Post to Slack is the admin's alone (pulse.config.json people.admin).
  const extras: NavItem[] = pageOn("slack") && isAdmin(session) ? [{ href: "/pulse/hq/slack", label: "Post to Slack", current: title === "Post to Slack" }] : [];
  const home = links[0]?.href.replace(/\?.*$/, "") ?? "/pulse";
  const menus = { links, extras, name: session?.name.split(" ")[0] ?? "", view, options: !!options };
  const tz = meta?.pulled_at?.match(/ ([A-Z]{1,4})$/)?.[1];
  return (
    <div className="hdr">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a className="brand" href={home} aria-label={`${CO.pulse_name} home`}><img alt={CO.name} src={CONFIG.brand.logo_on_dark} width={162} height={34} /></a>
        <h1>{title}</h1>
        <div className="band-r">
          <div className={`datachip${stale ? " stale" : ""}`} title={meta ? `Data pulled ${meta.pulled_at}` : undefined}>
            <i aria-hidden />
            <span><small>{CRM} data</small><b>{meta ? (tz ? meta.pulled_at.slice(0, -tz.length - 1) : meta.pulled_at) : "Waiting"}</b></span>
          </div>
          {meta?.quarter?.label ? <div className="periodchip">{meta.quarter.label}</div> : null}
          <HeaderMenus part="tools" {...menus} />
        </div>
      </header>
      <HeaderMenus part="tabs" {...menus} />
      <div className="pagehead">
        <h1 className="ph-title">{title}</h1>
        {children ? <div className="ph-x">{children}</div> : null}
        <div className="when">
          <span>{meta ? `Data pulled ${meta.pulled_at}` : "Waiting for the first data pull"}</span>
        </div>
      </div>
      {stale ? <div className="stale">This data is more than a day old ({Math.floor(hoursOld! / 24)} days). The next {CRM} pull should refresh it.</div> : null}
    </div>
  );
}
