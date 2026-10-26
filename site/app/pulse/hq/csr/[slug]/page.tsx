import { notFound } from "next/navigation";
import { requireLead } from "@/lib/pulse/auth";
import { getCsr, getMeta, hoursOld } from "@/lib/pulse/data";
import Header from "@/components/pulse/Header";
import CsrView from "@/components/pulse/CsrView";
import Footer from "@/components/pulse/Footer";
import { leadNav } from "@/components/pulse/nav";

export const dynamic = "force-dynamic";

// Leadership opens any CSR's screen, exactly as that CSR sees it.
export default async function CsrForLead({ params }: { params: { slug: string } }) {
  (await requireLead());
  const [meta, c] = await Promise.all([getMeta(), getCsr(params.slug)]);
  if (!c) notFound();
  return (
    <div className="wrap">
      <Header title={c.csr} meta={meta} hoursOld={hoursOld(meta)} nav={leadNav("rep")} />
      <CsrView c={c} viewer="lead" />
      <Footer />
    </div>
  );
}
