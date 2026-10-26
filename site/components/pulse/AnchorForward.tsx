"use client";
import { useEffect } from "react";

// Old links to a spot further down the Pulse (from Slack, bookmarks, the old menu) go to that section's own page now
//. The part after # never reaches the server, so this runs in the browser.
const MOVED: Record<string, string> = {
  map: "map", counties: "map#counties",
  team: "team", cards: "team#cards", meter: "team#meter", reps: "team#reps", csrs: "team#csrs",
  production: "production", cycle: "production#cycle",
  costs: "costs",
  marketing: "marketing", sources: "marketing#sources",
};

export default function AnchorForward({ week }: { week?: string }) {
  useEffect(() => {
    const go = () => {
      const to = MOVED[location.hash.slice(1)];
      if (!to) return;
      const [page, hash] = to.split("#");
      location.replace(`/pulse/hq/${page}${week ? `?week=${week}` : ""}${hash ? `#${hash}` : ""}`);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [week]);
  return null;
}
