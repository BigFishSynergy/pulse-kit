import { requireLead } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import Moneyball from "@/components/pulse/Moneyball";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// Moneyball for leadership: who to send where, what-if, hot and cold spots, where to advertise. From the Report Builder ledger.
export default async function MoneyballPage() {
  requirePage("moneyball");
  (await requireLead());
  const meta = await getMeta();
  return (
    <div className="wrap">
      <Header title="Moneyball" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("moneyball")} />
      {meta ? <Moneyball asOf={meta.as_of} /> : <div className="state"><h2>No numbers yet</h2></div>}
      <Footer />
    </div>
  );
}
