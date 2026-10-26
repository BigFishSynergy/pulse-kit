import { notFound } from "next/navigation";
import { isAdmin, requireLead } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import { listScreens, SLIDES } from "@/lib/pulse/tv";
import { requirePage } from "@/lib/pulse/pages";
import Header from "@/components/pulse/Header";
import Footer from "@/components/pulse/Footer";
import TvSetup from "@/components/pulse/TvSetup";
import { leadNav } from "@/components/pulse/nav";

export const dynamic = "force-dynamic";

// TV screens: the admin sets up each office TV by answering a few questions. Everyone else gets a plain 404.
export default async function TvPage() {
  requirePage("tv");
  const s = await requireLead();
  if (!isAdmin(s)) notFound();
  const [meta, screens] = await Promise.all([getMeta(), listScreens()]);
  return (
    <div className="wrap">
      <Header title="TV screens" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("tv")} />
      <TvSetup slides={SLIDES} screens={screens.map(({ id, name, audience, slides, seconds, dark }) => ({ id, name, audience, slides, seconds, dark }))} />
      <Footer />
    </div>
  );
}
