import { requireSalesSide } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import SpeedRound from "@/components/pulse/SpeedRound";
import Footer from "@/components/pulse/Footer";
import { csrNav, repNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// The weekly Speed Round for the sales side: reps and CSRs.
export default async function MyGame() {
  requirePage("speed_round");
  const s = (await requireSalesSide());
  const meta = await getMeta();
  return (
    <div className="wrap">
      <Header title="Speed Round" meta={meta} hoursOld={hoursOld(meta)} nav={s.role === "csr" ? csrNav("game") : repNav("game")} />
      <SpeedRound reportsHref="/pulse/me/reports" />
      <Footer />
    </div>
  );
}
