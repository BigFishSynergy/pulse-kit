import { requireCsr } from "@/lib/pulse/auth";
import { getCsr, getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import CsrView from "@/components/pulse/CsrView";
import Footer from "@/components/pulse/Footer";
import MyPhoto from "@/components/pulse/MyPhoto";
import { photoIndex } from "@/lib/pulse/photos";
import { csrNav } from "@/components/pulse/nav";
import { adminFirst, CO, CRM } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// A CSR's own screen. The server reads only this CSR's file.
export default async function MyCsrPulse() {
  const s = (await requireCsr());
  const [meta, c] = await Promise.all([getMeta(), getCsr(s.csr)]);
  return (
    <div className="wrap">
      <Header title="Pulse" meta={meta} hoursOld={hoursOld(meta)} nav={csrNav("me")} />
      {c ? <CsrView c={c} viewer="csr" /> : (
        <div className="state"><h2>Your numbers are on the way</h2><p className="sub">They show up after the next hourly data pull. If this stays empty, let {adminFirst()} know.</p></div>
      )}
      {!s.view ? <MyPhoto slug={s.csr} name={s.name} v={(await photoIndex())[s.csr]} /> : null}
      <Footer />
    </div>
  );
}
