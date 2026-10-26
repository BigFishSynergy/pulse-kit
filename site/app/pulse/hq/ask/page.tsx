import { requireLeadEditor } from "@/lib/pulse/auth";
import { getMeta, getPeople, getWeeks, hoursOld, WEEK } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import AskPage from "@/components/pulse/AskPage";
import { LEAD_ASK, LEAD_HELP } from "@/components/pulse/askChips";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// Ask Claude for leadership: the whole company or one rep's screen, plus how to use the site. Chats are saved per person.
export default async function Ask({ searchParams }: { searchParams: { q?: string; rep?: string; week?: string } }) {
  requirePage("ask_claude");
  requireLeadEditor();
  const weeks = await getWeeks();
  const week = searchParams.week && WEEK.test(searchParams.week) && weeks.some((w) => w.week_start === searchParams.week) ? searchParams.week : undefined;
  const [meta, people] = await Promise.all([getMeta(week), getPeople(week)]);
  const reps: [string, string][] = (people?.roster ?? []).map((r: { rep: string; slug: string }) => [r.slug, r.rep]);
  const rep = reps.some(([slug]) => slug === searchParams.rep) ? searchParams.rep : undefined;
  return (
    <div className="wrap">
      <Header title="Ask Claude" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("ask", week)} />
      {process.env.ANTHROPIC_API_KEY ? (
        <AskPage scope="lead" ask={LEAD_ASK} help={LEAD_HELP} reps={reps} week={week} initialQ={searchParams.q?.slice(0, 800)} initialRep={rep} />
      ) : <div className="state"><h2>Ask Claude is not switched on yet</h2></div>}
      <Footer />
    </div>
  );
}
