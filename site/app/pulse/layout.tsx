import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./pulse.css";
import Soundtrack from "@/components/pulse/Soundtrack";
import ActivityBeacon from "@/components/pulse/ActivityBeacon";
import { getSession } from "@/lib/pulse/auth";
import { OG } from "@/lib/pulse/og";
import { CO, CONFIG, pageOn } from "@/lib/pulse/config";

// The Pulse lives at /pulse on the company's own site. Its own fonts, colors (pulse.config.json brand) and title,
// kept out of search engines, and wrapped in .rr so none of it leaks into anything else on the site.

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--rr-display-font", display: "swap" });
const text = Inter({ subsets: ["latin"], weight: ["400", "600"], variable: "--rr-text-font", display: "swap" });

export const metadata: Metadata = {
  title: { absolute: CO.pulse_name },
  description: OG.description,
  robots: { index: false, follow: false, nocache: true },
  openGraph: { title: OG.title, description: OG.description, siteName: CO.name, type: "website", images: [{ url: OG.image, width: 1200, height: 630, alt: `The ${CO.pulse_name} by ${CO.name}` }] },
  twitter: { card: "summary_large_image", title: OG.title, description: OG.description, images: [OG.image] },
};

// Everyone opens in the light look; "rr.look" remembers a picked dark mode on that device.
const THEME = "try{var r=document.getElementById('rr'),t=localStorage.getItem('rr.look');if(t==='light'||t==='dark')r.dataset.theme=t;r.dataset.simple=localStorage.getItem('rr.simple')==='0'?'0':'1'}catch(e){}";

// The company's colors, on top of the neutral defaults in pulse.css.
const B = CONFIG.brand.colors;
const BRAND = { "--mark": `url("${CONFIG.brand.mark_on_dark}")`, "--head": B.primary, "--red": B.primary, "--head-ink": B.primary_ink, "--yellow": B.accent, "--accent-ink": B.accent_ink } as React.CSSProperties;

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="rr" className={`rr ${display.variable} ${text.variable}`} data-simple="1" style={BRAND} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME }} />
      {children}
      {pageOn("soundtrack") ? <Soundtrack signedIn={!!getSession()} /> : null}
      {getSession() ? <ActivityBeacon /> : null}
    </div>
  );
}
