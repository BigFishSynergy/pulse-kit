"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Tells the server which page someone opened, and adds an active minute while the tab is showing and they
// have touched the page in the last two minutes. Idle tabs left open overnight do not count.
export function logActivity(body: Record<string, string>) {
  try {
    fetch("/pulse/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch {}
}

export default function ActivityBeacon() {
  const path = usePathname();
  const lastTouch = useRef(Date.now());
  useEffect(() => { if (path) logActivity({ kind: "page", path }); }, [path]);
  useEffect(() => {
    const touch = () => (lastTouch.current = Date.now());
    const evs = ["pointerdown", "keydown", "scroll", "pointermove"];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastTouch.current < 120_000) logActivity({ kind: "beat" });
    }, 60_000);
    return () => { clearInterval(id); evs.forEach((e) => window.removeEventListener(e, touch)); };
  }, []);
  return null;
}
