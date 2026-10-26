import { requireRep } from "@/lib/pulse/auth";
import { cardFor, getCoaching, getMeta, getRep, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import RepView from "@/components/pulse/RepView";
import CleanRep from "@/components/pulse/CleanRep";
import LookToggle from "@/components/pulse/LookToggle";
import { getLook } from "@/lib/pulse/look";
import Footer from "@/components/pulse/Footer";
import { repNav } from "@/components/pulse/nav";
import { adminFirst, CO, CRM } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// A rep's own screen. The server reads only this rep's file and this rep's coaching card.
export default async function MyPulse() {
  const s = requireRep();
  const look = getLook();
  const [meta, rep] = await Promise.all([getMeta(), getRep(s.rep)]);
  const coaching = meta ? await getCoaching(meta.week_start) : null;
  return (
    <div className="wrap">
      <Header title="Pulse" meta={meta} hoursOld={hoursOld(meta)} nav={repNav("me")} options={!!rep && look === "full"}>
        {rep ? <LookToggle look={look} /> : null}
      </Header>
      {rep && look === "clean" ? (
        <CleanRep r={rep} canAsk={process.env.PULSE_ASK_REPS === "on" && !!process.env.ANTHROPIC_API_KEY} viewer="rep" />
      ) : rep ? (
        <RepView r={rep} card={cardFor(coaching, rep.rep)} cardAt={coaching?.generated_at} canAsk={process.env.PULSE_ASK_REPS === "on" && !!process.env.ANTHROPIC_API_KEY} viewer="rep" />
      ) : (
        <div className="state"><h2>Your numbers are on the way</h2><p className="sub">They show up after the next hourly data pull. If this stays empty, let {adminFirst()} know.</p></div>
      )}
      <Footer />
    </div>
  );
}
