// The one settings file for this company's Pulse (site/pulse.config.json). Every company-specific word, color,
// person, page switch and Slack channel comes from here, so the code never changes per client.
import raw from "../../pulse.config.json";

type Channel = { name: string; who: string };
export type PageKey =
  | "scorecard" | "reports" | "moneyball" | "map" | "team" | "power" | "production" | "costs" | "marketing" | "csr"
  | "speed_round" | "ask_claude" | "graphics" | "requests" | "activity" | "slack" | "soundtrack" | "tv" | "tips";

const C = raw as any;

export const CONFIG = {
  company: C.company as { name: string; short_name: string; pulse_name: string; site_url: string; what_we_do: string; service_area: string },
  brand: C.brand as { logo: string; logo_on_dark: string; mark_on_dark: string; colors: Record<string, string>; fonts: { display: string; body: string } },
  crm: C.crm as { name: string; connector: string; record_word: string },
  timezone: (C.timezone as string) || "America/New_York",
  people: C.people as { leadership: { name: string; initials: string; title: string }[]; nicknames: Record<string, string>; admin: string },
  jobNumberLabel: (C.job_number_label as string) || "Job #",
  /** messages (older copies call it slack): which service, the places it posts to, the daily messages switch. */
  slack: (C.messages ?? C.slack) as { service?: string; channels: Record<string, Channel>; daily_messages: boolean; requests_channel: string },
  goals: C.goals as { source: "sheet" | "file"; file: string; spend_sheet_id: string },
  map: C.map as { zips_file: string; shapes_file: string; region_word: string; center: [number, number]; zoom: number },
  support: (C.support ?? { name: "Benny Fisher", title: "Visionary Navigator", email: "benny@bennyfisher.com", site: "https://bennyfisher.com", call: "https://bennyfisher.com/book-a-call" }) as { name: string; title: string; email: string; site: string; call: string },
  pipeline: C.pipeline as { self_gen_source: string; at_risk_statuses: string[]; main_trade_word: string; csr_min_appointments: number },
};

export const CO = CONFIG.company;
export const CRM = CONFIG.crm.name;
export const TZ = CONFIG.timezone;

/** Is a whole page switched on in pulse.config.json? */
export const pageOn = (k: PageKey): boolean => (k === "slack" ? (C.pages?.messages ?? C.pages?.slack) : C.pages?.[k]) !== false && !(k === "slack" && (C.messages ?? C.slack)?.service === "none");

/** The time zone's short name right now ("CT", "ET"), for "Data pulled 7:59 PM CT". */
export function tzShort(d = new Date()): string {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
  return s.replace(/^(.)[SD]T$/, "$1T");
}

/** Leadership name for a scorecard owner's initials ("PO" -> "Pat Owner"), or the initials as written. */
export const ownerName = (initials: string): string =>
  CONFIG.people.leadership.find((p) => p.initials.toLowerCase() === String(initials || "").toLowerCase())?.name ?? initials;

/** The first name of the admin login, for "Ask Pat if you need more". */
export const adminFirst = (): string => {
  const a = CONFIG.people.admin;
  const lead = CONFIG.people.leadership.find((p) => p.name.toLowerCase().startsWith(a.toLowerCase()));
  return (lead?.name ?? a).split(" ")[0].replace(/^./, (x) => x.toUpperCase());
};
