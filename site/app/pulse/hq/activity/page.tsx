import { requireLeadEditor, users } from "@/lib/pulse/auth";
import { etDay, logsBetween } from "@/lib/pulse/activity";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ActivityView from "@/components/pulse/ActivityView";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

const shift = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

export default async function Activity() {
  requirePage("activity");
  requireLeadEditor();
  const today = etDay();
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7;
  const monday = shift(today, -dow);
  const ranges = [
    { key: "week", label: "This week", from: monday, to: today },
    { key: "last", label: "Last week", from: shift(monday, -7), to: shift(monday, -1) },
    { key: "30", label: "Last 30 days", from: shift(today, -29), to: today },
  ];
  const [meta, logs] = await Promise.all([getMeta(), logsBetween(shift(today, -35), today)]);
  return (
    <div className="wrap">
      <Header title="Activity" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("activity")} />
      <ActivityView logs={logs} everyone={users().map(({ u, name, role }) => ({ u, name, role }))} ranges={ranges} />
      <Footer />
    </div>
  );
}
