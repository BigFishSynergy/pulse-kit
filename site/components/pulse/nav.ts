// Page links for each side of the site. The sales side never links to leadership pages.
// `main` links sit in the header row; the rest go in the More menu. On a phone every link is in one Menu button.
// Pages switched off in pulse.config.json (pages) are left out here and return a 404 (lib/pulse/pages.ts).
import { pageOn, type PageKey } from "@/lib/pulse/config";

export type NavItem = { href: string; label: string; current?: boolean; main?: boolean };

export type LeadPage = "pulse" | "reports" | "rep" | "ask" | "moneyball" | "game" | "requests" | "activity" | "slack" | "people"
  | "map" | "team" | "production" | "costs" | "marketing" | "scorecard";

const on = (k: PageKey | null) => k === null || pageOn(k);

export function leadNav(at: LeadPage, week?: string): NavItem[] {
  const q = week ? `?week=${week}` : "";
  const all: [PageKey | null, NavItem][] = [
    [null, { href: `/pulse/hq/pulse${q}`, label: "Pulse", current: at === "pulse", main: true }],
    ["scorecard", { href: "/pulse/hq/scorecard", label: "Scorecard", current: at === "scorecard", main: true }],
    ["reports", { href: "/pulse/hq/reports", label: "Reports", current: at === "reports", main: true }],
    ["moneyball", { href: "/pulse/hq/moneyball", label: "Moneyball", current: at === "moneyball", main: true }],
    ["map", { href: `/pulse/hq/map${q}`, label: "Map", current: at === "map", main: true }],
    ["team", { href: `/pulse/hq/team${q}`, label: "Team", current: at === "team" || at === "rep", main: true }],
    ["production", { href: `/pulse/hq/production${q}`, label: "Production", current: at === "production" }],
    ["costs", { href: `/pulse/hq/costs${q}`, label: "Job costing", current: at === "costs" }],
    ["marketing", { href: `/pulse/hq/marketing${q}`, label: "Marketing", current: at === "marketing" }],
    ["speed_round", { href: "/pulse/hq/game", label: "Speed Round", current: at === "game" }],
    ["ask_claude", { href: `/pulse/hq/ask${q}`, label: "Ask Claude", current: at === "ask" }],
    ["requests", { href: "/pulse/hq/requests", label: "Requests", current: at === "requests" }],
    ["activity", { href: "/pulse/hq/activity", label: "Activity", current: at === "activity" }],
  ];
  return all.filter(([k]) => on(k)).map(([, n]) => n);
}

export function csrNav(at: "me" | "game"): NavItem[] {
  return [
    { href: "/pulse/csr", label: "My numbers", current: at === "me", main: true },
    ...(pageOn("speed_round") ? [{ href: "/pulse/me/game", label: "Speed Round", current: at === "game", main: true }] : []),
  ];
}

export function repNav(at: "me" | "reports" | "ask" | "game"): NavItem[] {
  return [
    { href: "/pulse/me", label: "My numbers", current: at === "me", main: true },
    ...(pageOn("reports") ? [{ href: "/pulse/me/reports", label: "My reports", current: at === "reports", main: true }] : []),
    ...(pageOn("speed_round") ? [{ href: "/pulse/me/game", label: "Speed Round", current: at === "game", main: true }] : []),
    ...(pageOn("ask_claude") && process.env.PULSE_ASK_REPS === "on" ? [{ href: "/pulse/me/ask", label: "Ask Claude", current: at === "ask", main: true }] : []),
  ];
}
