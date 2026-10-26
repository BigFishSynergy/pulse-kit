import SuggestBox from "./SuggestBox";
import { getSession } from "@/lib/pulse/auth";
import { CO, CRM, pageOn } from "@/lib/pulse/config";

export default function Footer() {
  return (
    <>
    {getSession()?.view || !pageOn("requests") ? null : <SuggestBox />}
    <footer>
      <div>Counts follow {CO.name}&apos;s own rules, checked against the certified {CRM} reports. Refreshed after each {CRM} update.</div>
      <div>Weeks run Monday to Sunday. Records show job numbers and {CRM} links only, never customer names.</div>
      <div>Sign-ins, pages visited and questions asked here are logged so leadership can see what&apos;s useful and keep improving the Pulse.</div>
    </footer>
    </>
  );
}
