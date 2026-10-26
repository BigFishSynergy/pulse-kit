import { requireRep } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import AskPage from "@/components/pulse/AskPage";
import { REP_ASK, REP_HELP } from "@/components/pulse/askChips";
import Footer from "@/components/pulse/Footer";
import { repNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// Ask Claude for a rep: only their own numbers and the leaderboard tops, plus how to use their screen.
export default async function MyAsk({ searchParams }: { searchParams: { q?: string } }) {
  requirePage("ask_claude");
  (await requireRep());
  const meta = await getMeta();
  const on = process.env.PULSE_ASK_REPS === "on" && !!process.env.ANTHROPIC_API_KEY;
  return (
    <div className="wrap">
      <Header title="Ask Claude" meta={meta} hoursOld={hoursOld(meta)} nav={repNav("ask")} />
      {on ? <AskPage scope="rep" ask={REP_ASK} help={REP_HELP} initialQ={searchParams.q?.slice(0, 800)} />
        : <div className="state"><h2>Ask Claude is not switched on for the sales team yet</h2></div>}
      <Footer />
    </div>
  );
}
