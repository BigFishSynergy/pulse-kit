import { requireLead } from "@/lib/pulse/auth";
import { getCoaching, getLeadership, getMeta, getPeople, getWeeks, hoursOld, WEEK } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import PulseView from "@/components/pulse/PulseView";
import CleanPulse from "@/components/pulse/CleanPulse";
import LookToggle from "@/components/pulse/LookToggle";
import ArchiveNote from "@/components/pulse/ArchiveNote";
import AnchorForward from "@/components/pulse/AnchorForward";
import { WeekSelect } from "@/components/pulse/ui";
import { getLook } from "@/lib/pulse/look";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { dfmt } from "@/lib/pulse/format";
import TipCard from "@/components/pulse/TipCard";
import { supportLinks, tipFrom } from "@/lib/pulse/support";
import { pageOn } from "@/lib/pulse/config";
import { facesOn, photoIndex } from "@/lib/pulse/photos";

export const dynamic = "force-dynamic";

// The leadership Pulse, for the latest numbers or any saved week. Clean is the short version; Everything adds the
// scorecard, trends and a link to each deeper page (Map, Team, Production, Job costing, Marketing).
export default async function Pulse({ searchParams }: { searchParams: { week?: string } }) {
  const me = (await requireLead());
  const look = getLook();
  const weeks = await getWeeks();
  const week = searchParams.week && WEEK.test(searchParams.week) && weeks.some((w) => w.week_start === searchParams.week) && searchParams.week !== weeks[0]?.week_start ? searchParams.week : undefined;
  const [meta, s, people] = await Promise.all([getMeta(week), getLeadership(week), getPeople(week)]);
  const coaching = meta ? await getCoaching(meta.week_start) : null;
  const repSlugs: Record<string, string> = Object.fromEntries((people?.roster ?? []).map((r: { rep: string; slug: string }) => [r.rep, r.slug]));
  const photos = await photoIndex();
  const tip = pageOn("tips") ? tipFrom(s?.scoreboard) : null;
  const latest = weeks[0] ? `Latest numbers (${weeks[0].pulled_at.replace(/,.*/, "")})` : "Latest numbers";
  return (
    <div className="wrap">
      <AnchorForward week={week} />
      <Header title="Pulse" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("pulse", week)} trial options={look === "full"}>
        {s ? <LookToggle look={look} /> : null}
      </Header>
      <ArchiveNote week={week} back="/pulse/hq/pulse" />
      {tip && !week && !me.view ? <TipCard tip={tip} week={meta?.week_start ?? ""} {...supportLinks()} /> : null}
      {s && look === "clean" ? (
        <CleanPulse s={s} coaching={coaching} repSlugs={repSlugs} photos={photos} faces={facesOn(photos)} canAsk={!me.view && !!process.env.ANTHROPIC_API_KEY} week={week ?? ""} first={me.name.split(" ")[0]} />
      ) : s ? (
        <PulseView s={s} coaching={coaching} repSlugs={repSlugs} canAsk={!me.view && !!process.env.ANTHROPIC_API_KEY} week={week ?? ""} first={me.name.split(" ")[0]} />
      ) : (
        <div className="state"><h2>No numbers yet</h2><p className="sub">The hourly data job has not written a snapshot yet. Check the pulse-data workflow in GitHub.</p></div>
      )}
      <WeekSelect weeks={weeks.map((w) => ({ week_start: w.week_start, label: `Week of ${dfmt(w.week_start)} to ${dfmt(w.week_end)}, saved ${w.pulled_at.replace(/ ET$/, "")}` }))}
        current={week ?? weeks[0]?.week_start ?? ""} base="/pulse/hq/pulse" latest={latest} />
      <Footer />
    </div>
  );
}
