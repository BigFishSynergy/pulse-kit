// Which region (county) a zip is in, so every town on the site can say where it is. The service area, its regions and
// each zip's town come from content/zips.json (pulse.config.json map.zips_file), built by scripts/make_zip_files.py.
// Zips the company does not serve but still gets leads from can be listed with the region "OUT": the map draws them as
// one gray block and their numbers stay off the colors, rankings and totals.
import ZIPS from "../../content/zips.json";

export type County = string;
const Z = (ZIPS as any).zips as Record<string, { town: string; region: string; lat: number; lng: number }>;

/** The regions in the service area, in the order the zips file lists them. */
export const REGIONS: string[] = ((ZIPS as any).regions as string[]) ?? [];
/** What the out-of-area block is called on screen. */
export const OUTSIDE = ((ZIPS as any).outside_label as string) || "Outside the service area";
/** The word for a region ("County", "Parish", "Area"). */
export const REGION_WORD = ((ZIPS as any).region_word as string) || "County";

export function county(zip?: string | null): County | null {
  if (!zip || !/^\d{5}$/.test(zip)) return null;
  return Z[zip]?.region ?? null;
}

/** "Cedar Hollow (North County)", or just the town when the zip is outside the service area. */
export function townCounty(town: string, zip?: string | null) {
  const c = county(zip);
  return c && c !== "OUT" ? `${town} (${c})` : town;
}
