import type { Metadata } from "next";
import "./globals.css";
import { CO } from "@/lib/pulse/config";

export const metadata: Metadata = {
  metadataBase: new URL(CO.site_url),
  title: { default: CO.pulse_name, template: `%s | ${CO.pulse_name}` },
  description: `${CO.pulse_name}, for the ${CO.name} team.`,
  robots: { index: false, follow: false },
  icons: { icon: "/pulse/brand/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
