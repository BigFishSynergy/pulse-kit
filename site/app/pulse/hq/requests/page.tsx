import { requireLeadEditor } from "@/lib/pulse/auth";
import { getMeta, hoursOld } from "@/lib/pulse/data";
import { listRequests } from "@/lib/pulse/requests";
import Header from "@/components/pulse/Header";
import RequestsView from "@/components/pulse/RequestsView";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";
import { requirePage } from "@/lib/pulse/pages";

export const dynamic = "force-dynamic";

export default async function Requests() {
  requirePage("requests");
  requireLeadEditor();
  const [meta, reqs] = await Promise.all([getMeta(), listRequests()]);
  return (
    <div className="wrap">
      <Header title="Requests" meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("requests")} />
      <RequestsView initial={reqs} />
      <Footer />
    </div>
  );
}
