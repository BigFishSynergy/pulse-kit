"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { MeterBadge } from "./HotCold";
import { moneyK, n0, pct } from "@/lib/pulse/format";

// The POWER rankings as cards: first, second and third big across the top, fourth to ninth smaller underneath, and
// anyone else (rookies still earning a card) on one line below. Each card: face, name, the POWER number big, and the six
// skills it's built from as bars (the tick on each bar is the team average, 75), plus the last 30 days in one line.
const SKILLS = ["money", "closer", "ticket", "hustle", "rapid", "selfgen"];
const bar = (r: number) => `${Math.max(0, Math.min(100, ((r - 40) / 59) * 100))}%`;
const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2);

function Face({ src, name, big }: { src?: string | null; name: string; big?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className={`pb-face${big ? " big" : ""}`} src={src} alt="" /> : <span className={`pb-face none${big ? " big" : ""}`}>{initials(name)}</span>;
}

function Card({ r, c, place, temp, href, photo }: { r: any; c: any; place: number; temp?: any; href: string; photo?: string | null }) {
  const top = place <= 3;
  return (
    <Link href={href} className={`pb-card${top ? " top" : ""} p${place}`}>
      <div className="pb-head">
        <span className="pb-place">{place}</span>
        <Face src={photo} name={r.rep} big={top} />
        <div className="pb-power"><b className="num">{c.power}</b><small>POWER</small></div>
      </div>
      <div className="pb-name"><span>{r.rep}</span>{temp ? <MeterBadge level={temp.level} sold={temp.sold} small /> : null}</div>
      <ul className="pb-skills">
        {SKILLS.filter((k) => c.skills?.[k]).map((k) => {
          const sk = c.skills[k];
          return <li key={k} className={sk.rating >= 85 ? "hot" : ""}><span>{sk.label}</span><i><b style={{ width: bar(sk.rating) }} /><em style={{ left: bar(75) }} /></i><strong className="num">{sk.rating}</strong></li>;
        })}
      </ul>
      <div className="pb-foot">
        <span><b className="num">{moneyK(r.sales_30)}</b> sales</span>
        <span><b className="num">{n0(r.jobs_sold_30)}</b> jobs</span>
        <span><b className="num">{r.close_30?.pct != null ? pct(r.close_30.pct, 0) : "–"}</b> close</span>
      </div>
    </Link>
  );
}

export default function PowerBoard({ team, power, temp, coming, href, photo }: {
  team: any[]; power: Record<string, any>; temp: Record<string, any>; coming: Set<unknown>;
  href: (rep: string) => string; photo: (rep: string) => string | null;
}) {
  const ranked = team.filter((r) => power[r.rep]);
  const rest = team.filter((r) => !power[r.rep]);
  const extra = ranked.slice(9);
  return (
    <div className="pb">
      <div className="pb-podium">{ranked.slice(0, 3).map((r, i) => <Card key={r.rep} r={r} c={power[r.rep]} place={i + 1} temp={temp[r.rep]} href={href(r.rep)} photo={photo(r.rep)} />)}</div>
      {ranked.length > 3 ? <div className="pb-grid">{ranked.slice(3, 9).map((r, i) => <Card key={r.rep} r={r} c={power[r.rep]} place={i + 4} temp={temp[r.rep]} href={href(r.rep)} photo={photo(r.rep)} />)}</div> : null}
      {extra.length || rest.length ? (
        <p className="pb-more sub">
          {extra.length ? <>Also ranked: {extra.map((r, i) => <span key={r.rep}>{i ? ", " : ""}<Link href={href(r.rep)}>{r.rep}</Link> {power[r.rep].power}</span>)}. </> : null}
          {rest.length ? <>Earning a card: {rest.map((r, i) => <span key={r.rep}>{i ? ", " : ""}<Link href={href(r.rep)}>{r.rep}</Link>{coming.has(r.rep) ? " (rookie)" : ""}</span>)}.</> : null}
        </p>
      ) : null}
    </div>
  );
}
