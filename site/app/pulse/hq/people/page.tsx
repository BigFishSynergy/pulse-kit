import { notFound } from "next/navigation";
import { isAdmin, requireLead, users } from "@/lib/pulse/auth";
import { getFacts, getMeta, getPeople, hoursOld } from "@/lib/pulse/data";
import { inEnv } from "@/lib/pulse/userstore";
import Header from "@/components/pulse/Header";
import Footer from "@/components/pulse/Footer";
import PeopleAdmin from "@/components/pulse/PeopleAdmin";
import TeamPhotos from "@/components/pulse/TeamPhotos";
import { facesOn, photoIndex } from "@/lib/pulse/photos";
import { leadNav } from "@/components/pulse/nav";
import { lastSeenDays } from "@/lib/pulse/activity";
import { canSendLinks, sendable } from "@/lib/pulse/sendlink";
import { DM_LABEL, DM_WORD, PERSONAL, WAY } from "@/lib/pulse/slack";

export const dynamic = "force-dynamic";

const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const day = (d?: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");

// People: the admin adds, resets and removes logins here (no terminal), sees when each person was last on, and with Slack
// or email sends someone their own sign-in link. Everyone else gets a plain 404.
export default async function People({ searchParams }: { searchParams: { welcome?: string } }) {
  const s = await requireLead();
  if (!isAdmin(s)) notFound();
  const [meta, facts, all, photos, people, seen] = await Promise.all([getMeta(), getFacts(), users(), photoIndex(), getPeople(), lastSeenDays()]);
  const list = all.filter((u) => u.u !== "guest");
  // the roster with the data job's own slugs (names on screen may be nicknames; slugs never change)
  const roster: { rep: string; slug: string }[] = people?.roster ?? (facts?.roster ?? []).map((n: string) => ({ rep: n, slug: slug(n) }));
  const reps: string[] = roster.map((r) => r.rep);
  const csrs: string[] = (facts?.dims?.csr ?? []).filter((x: string) => x && !x.startsWith("(") && x !== "Former reps" && x !== "Other");
  return (
    <div className="wrap">
      <Header title="People" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("people")} />
      <PeopleAdmin
        welcome={!!searchParams.welcome}
        me={s.u}
        people={list.map((u) => ({ u: u.u, name: u.name, role: u.role, sees: u.rep ?? u.csr ?? "", env: inEnv(u.u), dm: u.dm ?? "", last: day(seen[u.u]), send: sendable(u) }))}
        links={PERSONAL ? { on: canSendLinks(), way: WAY, label: DM_LABEL, word: DM_WORD, never: list.filter((u) => sendable(u) && u.u !== s.u && !seen[u.u]).length } : null}
        reps={roster.map((r) => ({ name: r.rep, slug: r.slug }))}
        csrs={csrs.map((n) => ({ name: n, slug: slug(n) }))}
      />
      <TeamPhotos on={facesOn(photos)} people={[...roster.map((r) => ({ name: r.rep, slug: r.slug })), ...csrs.map((n) => ({ name: n, slug: slug(n) }))].map((x) => ({ ...x, v: photos[x.slug] }))} />
      <Footer />
    </div>
  );
}
