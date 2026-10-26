import { requireLead } from "@/lib/pulse/auth";
import { getLeadership, getMeta, hoursOld, pickWeek } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ArchiveNote from "@/components/pulse/ArchiveNote";
import JobCosting from "@/components/pulse/JobCosting";
import { PageHelp } from "@/components/pulse/SecHelp";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// Job costing and GP. A section of the Pulse until Oct 14 2026 (/hq/pulse#costs forwards here).
export default async function CostsPage({ searchParams }: { searchParams: { week?: string } }) {
  requirePage("costs");
  requireLead();
  const week = await pickWeek(searchParams.week);
  const [meta, s] = await Promise.all([getMeta(week), getLeadership(week)]);
  return (
    <div className="wrap">
      <Header title="Job costing" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("costs", week)} options />
      <ArchiveNote week={week} back="/pulse/hq/costs" />
      {s?.costs ? (
        <div className="simple-page">
          <PageHelp keys={["costs"]} />
          <JobCosting c={s.costs} />
        </div>
      ) : <div className="state"><h2>No job costing yet</h2><p className="sub">It shows up after the next data pull that has the Job Expenses report.</p></div>}
      <Footer />
    </div>
  );
}
