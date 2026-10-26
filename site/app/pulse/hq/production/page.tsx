import { requireLead } from "@/lib/pulse/auth";
import { getLeadership, getMeta, hoursOld, pickWeek } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ArchiveNote from "@/components/pulse/ArchiveNote";
import { Production } from "@/components/pulse/PulseView";
import CycleClocks from "@/components/pulse/Clocks";
import { PageHelp } from "@/components/pulse/SecHelp";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// Production and cycle time. Sections of the Pulse until Oct 14 2026 (/hq/pulse#production forwards here).
export default async function ProductionPage({ searchParams }: { searchParams: { week?: string } }) {
  requirePage("production");
  (await requireLead());
  const week = await pickWeek(searchParams.week);
  const [meta, s] = await Promise.all([getMeta(week), getLeadership(week)]);
  return (
    <div className="wrap">
      <Header title="Production" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("production", week)} options />
      <ArchiveNote week={week} back="/pulse/hq/production" />
      {s ? (
        <div className="simple-page">
          <PageHelp keys={["production", "cycle"]} />
          <Production s={s} />
          <CycleClocks c={s.cycle} />
        </div>
      ) : <div className="state"><h2>No numbers yet</h2><p className="sub">The hourly data job has not written a snapshot yet.</p></div>}
      <Footer />
    </div>
  );
}
