import { requireLead } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ReportBuilder from "@/components/pulse/ReportBuilder";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

export default async function Reports() {
  requirePage("reports");
  const me = (await requireLead());
  const meta = await getMeta();
  return (
    <div className="wrap">
      <Header title="Reports" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("reports")} />
      {meta ? <ReportBuilder asOf={meta.as_of} canGraphic={!me.view && !!process.env.ANTHROPIC_API_KEY} /> : <div className="state"><h2>No numbers yet</h2></div>}
      <Footer />
    </div>
  );
}
