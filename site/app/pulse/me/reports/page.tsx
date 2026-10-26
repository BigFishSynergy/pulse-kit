import { requireRep } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ReportBuilder from "@/components/pulse/ReportBuilder";
import Footer from "@/components/pulse/Footer";
import { repNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// A rep's own report builder. The API only ever sends this rep's records.
export default async function MyReports() {
  requirePage("reports");
  const s = requireRep();
  const meta = await getMeta();
  return (
    <div className="wrap">
      <Header title="My reports" meta={meta} hoursOld={hoursOld(meta)} nav={repNav("reports")} />
      {meta ? <ReportBuilder asOf={meta.as_of} rep={s.rep} repName={s.name} canGraphic={process.env.PULSE_ASK_REPS === "on" && !!process.env.ANTHROPIC_API_KEY} /> : <div className="state"><h2>No numbers yet</h2></div>}
      <Footer />
    </div>
  );
}
