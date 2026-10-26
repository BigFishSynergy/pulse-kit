import { requireLeadEditor } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import SpeedRound from "@/components/pulse/SpeedRound";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// The weekly Speed Round for leadership: same game as the reps, with company-wide report hunts.
export default async function Game() {
  requirePage("speed_round");
  (await requireLeadEditor());
  const meta = await getMeta();
  return (
    <div className="wrap">
      <Header title="Speed Round" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("game")} />
      <SpeedRound reportsHref="/pulse/hq/reports" />
      <Footer />
    </div>
  );
}
