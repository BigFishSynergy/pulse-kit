import { requireLead } from "@/lib/pulse/auth";
import { getLeadership, getMeta, hoursOld, pickWeek } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ArchiveNote from "@/components/pulse/ArchiveNote";
import { Marketing, Sources } from "@/components/pulse/PulseView";
import { PageHelp } from "@/components/pulse/SecHelp";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// Marketing: leads by source by month, cost by source, and what each lead source turns into.
// Sections of the Pulse until Oct 14 2026.
export default async function MarketingPage({ searchParams }: { searchParams: { week?: string } }) {
  requirePage("marketing");
  requireLead();
  const week = await pickWeek(searchParams.week);
  const [meta, s] = await Promise.all([getMeta(week), getLeadership(week)]);
  return (
    <div className="wrap">
      <Header title="Marketing" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("marketing", week)} options />
      <ArchiveNote week={week} back="/pulse/hq/marketing" />
      {s ? (
        <div className="simple-page">
          <PageHelp keys={["marketing", "sources"]} />
          <Marketing s={s} />
          <Sources s={s} />
        </div>
      ) : <div className="state"><h2>No numbers yet</h2><p className="sub">The hourly data job has not written a snapshot yet.</p></div>}
      <Footer />
    </div>
  );
}
