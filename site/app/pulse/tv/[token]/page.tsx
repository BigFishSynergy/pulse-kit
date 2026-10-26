import { notFound } from "next/navigation";
import { pageOn } from "@/lib/pulse/config";
import { screenFor, slideData } from "@/lib/pulse/tv";
import TvShow from "@/components/pulse/TvShow";

export const dynamic = "force-dynamic";

// One office TV. Its own link signs it in (view only, just its own slides); a removed TV or a wrong link gets a 404.
export default async function Tv({ params }: { params: { token: string } }) {
  if (!pageOn("tv")) notFound();
  const s = await screenFor(params.token);
  if (!s) notFound();
  const { meta, slides } = await slideData(s);
  return <TvShow name={s.name} seconds={s.seconds} dark={s.dark} meta={meta} slides={slides} />;
}
