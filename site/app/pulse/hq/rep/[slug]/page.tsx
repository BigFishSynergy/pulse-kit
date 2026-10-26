import { notFound } from "next/navigation";
import { requireLead } from "@/lib/pulse/auth";
import { cardFor, getCoaching, getMeta, getRep, getWeeks, hoursOld, WEEK } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import RepView from "@/components/pulse/RepView";
import CleanRep from "@/components/pulse/CleanRep";
import LookToggle from "@/components/pulse/LookToggle";
import { getLook } from "@/lib/pulse/look";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";

export const dynamic = "force-dynamic";

// Leadership opens any rep's screen, exactly as that rep sees it.
export default async function RepForLead({ params, searchParams }: { params: { slug: string }; searchParams: { week?: string } }) {
  const me = (await requireLead());
  const look = getLook();
  const weeks = await getWeeks();
  const week = searchParams.week && WEEK.test(searchParams.week) && weeks.some((w) => w.week_start === searchParams.week) ? searchParams.week : undefined;
  const [meta, rep] = await Promise.all([getMeta(week), getRep(params.slug, week)]);
  if (!rep) notFound();
  const coaching = meta ? await getCoaching(meta.week_start) : null;
  return (
    <div className="wrap">
      <Header title={rep.rep} meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("rep", week)} options={look === "full"}>
        <LookToggle look={look} />
      </Header>
      {look === "clean" ? <CleanRep r={rep} canAsk={!me.view && !!process.env.ANTHROPIC_API_KEY} viewer="lead" week={week} />
        : <RepView r={rep} card={cardFor(coaching, rep.rep)} cardAt={coaching?.generated_at} canAsk={!me.view && !!process.env.ANTHROPIC_API_KEY} viewer="lead" week={week} />}
      <Footer />
    </div>
  );
}
