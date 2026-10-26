import { requireLead } from "@/lib/pulse/auth";
import { getLeadership, getMeta, hoursOld, pickWeek } from "@/lib/pulse/data";
import { listCash } from "@/lib/pulse/cash";
import Header from "@/components/pulse/Header";
import ArchiveNote from "@/components/pulse/ArchiveNote";
import Scorecard from "@/components/pulse/Scorecard";
import { PageHelp } from "@/components/pulse/SecHelp";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// The leadership Scorecard: week, month and quarter as a board of boxes, the three things to fix,
// and which manager is on red alert. Numbers from pipeline/scoreboard.py; cash is typed in on the page.
export default async function ScorecardPage({ searchParams }: { searchParams: { week?: string } }) {
  requirePage("scorecard");
  const s0 = requireLead();
  const week = await pickWeek(searchParams.week);
  const [meta, s, cash] = await Promise.all([getMeta(week), getLeadership(week), listCash()]);
  const sb = (s as any)?.scoreboard; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <div className="wrap">
      <Header title="Scorecard" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("scorecard", week)} />
      <ArchiveNote week={week} back="/pulse/hq/scorecard" />
      {sb ? (
        <>
          <PageHelp keys={["scoreboard"]} />
          <Scorecard sb={sb} cash={cash[0] ?? null} canEdit={!s0.view} />
        </>
      ) : <div className="state"><h2>The Scorecard starts with the next data pull</h2><p className="sub">The hourly data job adds it. Check back in an hour.</p></div>}
      <Footer />
    </div>
  );
}
