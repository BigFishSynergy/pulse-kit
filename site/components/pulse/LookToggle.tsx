"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Seg } from "./ui";

/** Clean or Everything: which sections this page shows. Remembered on this device for a year; the page redraws in the
 *  chosen look. Sits at the right of the page title. */
export default function LookToggle({ look }: { look: "clean" | "full" }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const pick = (v: string) => {
    if (v === look) return;
    document.cookie = `rr_look=${v}; path=/pulse; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  };
  return (
    <div className={`looktoggle${busy ? " busy" : ""}`} title="Clean is the short version. Everything adds the scorecard, trends and links to every page.">
      <Seg label="Show" value={look} options={[["clean", "Clean"], ["full", "Everything"]]} onChange={pick} />
    </div>
  );
}
