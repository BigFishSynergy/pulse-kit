import { requireLead } from "@/lib/pulse/auth";
import { getCoaching, getLeadership, getMeta, getPeople, hoursOld, pickWeek } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ArchiveNote from "@/components/pulse/ArchiveNote";
import { CloseAndReps, Team } from "@/components/pulse/PulseView";
import HotColdBoard from "@/components/pulse/HotCold";
import PlayerCards from "@/components/pulse/PlayerCards";
import CsrTeam from "@/components/pulse/CsrTeam";
import { PageHelp } from "@/components/pulse/SecHelp";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// The people: this week's card for each person, close rate and the reps table, hot and cold, player cards and the CSRs.
// These were sections of the Pulse until Oct 14 2026 (/hq/pulse#cards and #meter forward here).
export default async function TeamPage({ searchParams }: { searchParams: { week?: string } }) {
  requirePage("team");
  requireLead();
  const week = await pickWeek(searchParams.week);
  const [meta, s, people] = await Promise.all([getMeta(week), getLeadership(week), getPeople(week)]);
  const coaching = meta ? await getCoaching(meta.week_start) : null;
  const repSlugs: Record<string, string> = Object.fromEntries((people?.roster ?? []).map((r: { rep: string; slug: string }) => [r.rep, r.slug]));
  return (
    <div className="wrap">
      <Header title="Team" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("team", week)} options />
      <ArchiveNote week={week} back="/pulse/hq/team" />
      {s ? (
        <div className="simple-page">
          <PageHelp keys={["team", "close", "reps", "meter", "cards"]} />
          <Team c={coaching} repSlugs={repSlugs} week={week ?? ""} dataAt={s.generated_at} />
          <CloseAndReps s={s} repSlugs={repSlugs} week={week ?? ""} />
          <HotColdBoard meter={s.meter} week={week} />
          <PlayerCards cards={s.cards} week={week} />
          <div className="clean"><CsrTeam cc={s.csr_cards} /></div>
        </div>
      ) : <div className="state"><h2>No numbers yet</h2><p className="sub">The hourly data job has not written a snapshot yet.</p></div>}
      <Footer />
    </div>
  );
}
