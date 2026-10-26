import { notFound } from "next/navigation";
import { isAdmin, requireLead } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import { PULSE_SLACK_CHANNELS, SERVICE, SERVICE_NAME, slackReady } from "@/lib/pulse/slack";
import { DAILY, readSettings } from "@/lib/pulse/daily";
import Header from "@/components/pulse/Header";
import Footer from "@/components/pulse/Footer";
import SlackPost from "@/components/pulse/SlackPost";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

// The admin's Post a message page: the only way a person's words reach a channel. Everyone else gets a plain 404.
export default async function PostToSlack() {
  requirePage("slack");
  const s = (await requireLead());
  if (!isAdmin(s)) notFound();
  const [meta, settings] = await Promise.all([getMeta(), readSettings()]);
  const places = [
    { key: "me", name: "Your DMs", who: "only you" },
    ...Object.entries(PULSE_SLACK_CHANNELS).map(([key, c]) => ({ key, name: c.name, who: c.who })),
  ];
  return (
    <div className="wrap">
      <Header title="Post a message" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("slack")} />
      <SlackPost places={places} ready={slackReady()} daily={DAILY} settings={settings} service={SERVICE_NAME[SERVICE]} />
      <Footer />
    </div>
  );
}
