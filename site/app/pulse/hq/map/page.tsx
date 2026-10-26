import { requireLead } from "@/lib/pulse/auth";
import { getGeo, getMeta, hoursOld, pickWeek } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import ArchiveNote from "@/components/pulse/ArchiveNote";
import IslandMap from "@/components/pulse/IslandMap";
import CountyCompare from "@/components/pulse/CountyCompare";
import { PageHelp } from "@/components/pulse/SecHelp";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { adminFirst, CO, CRM } from "@/lib/pulse/config";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// The service-area map and the regions side by side (/hq/pulse#map forwards here).
export default async function MapPage({ searchParams }: { searchParams: { week?: string } }) {
  requirePage("map");
  requireLead();
  const week = await pickWeek(searchParams.week);
  const [meta, geo] = await Promise.all([getMeta(week), getGeo(week)]);
  return (
    <div className="wrap">
      <Header title="Map" meta={meta} hoursOld={week ? null : hoursOld(meta)} nav={leadNav("map", week)} options />
      <ArchiveNote week={week} back="/pulse/hq/map" />
      {geo ? (
        <div className="simple-page">
          <PageHelp keys={["map", "counties"]} />
          <IslandMap geo={geo} title="Map" subtitle={`Where ${CO.short_name} wins, by zip code. Brighter green is better.`} />
          <CountyCompare geo={geo} />
        </div>
      ) : <div className="state"><h2>No map yet</h2><p className="sub">The hourly data job has not written the map numbers yet.</p></div>}
      <Footer />
    </div>
  );
}
