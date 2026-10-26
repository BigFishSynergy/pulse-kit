import SuggestBox from "./SuggestBox";
import { getSession } from "@/lib/pulse/auth";
import { CO, CRM, pageOn } from "@/lib/pulse/config";
import { supportLinks } from "@/lib/pulse/support";

export default async function Footer() {
  const s = await getSession();
  const L = supportLinks();
  return (
    <>
    {s?.view || !pageOn("requests") ? null : <SuggestBox />}
    <footer>
      <div>Counts follow {CO.name}&apos;s own rules, checked against the certified {CRM} reports. Refreshed after each {CRM} update.</div>
      <div>Weeks run Monday to Sunday. Records show job numbers and {CRM} links only, never customer names.</div>
      <div>Sign-ins, pages visited and questions asked here are logged so leadership can see what&apos;s useful and keep improving the Pulse.</div>
      <div className="kitline">Pulse Kit from <a href={L.site} target="_blank" rel="noopener noreferrer">{L.name}, {L.title}</a>{s?.role === "lead" && !s.view ? <> · <a href={L.help}>Message {L.name.split(" ")[0]}</a> · <a href={L.brand}>Help with my brand</a></> : null}</div>
    </footer>
    </>
  );
}
