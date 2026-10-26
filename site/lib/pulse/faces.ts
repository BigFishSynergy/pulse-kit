// Where a person's face comes from, for every card, ranking and TV: an uploaded photo (a version number, served privately
// by /pulse/api/photo/<slug>) or one of the 25 avatars they picked ("avatar:<name>", public/pulse/avatars, Notionists by
// Zoish, CC0). Uploaded photos are turned black and white in the browser so photos and avatars look like one set.
import LIST from "@/public/pulse/avatars/index.json";

export const AVATARS: string[] = LIST as string[];
export type Face = number | string | undefined | null;
export const isAvatar = (v: Face): v is string => typeof v === "string" && v.startsWith("avatar:") && AVATARS.includes(v.slice(7));

export function faceSrc(slug: string, v: Face, tv?: string): string | null {
  if (isAvatar(v)) return `/pulse/avatars/${v.slice(7)}.svg`;
  if (typeof v === "number") return `/pulse/api/photo/${slug}?v=${v}${tv ? `&tv=${encodeURIComponent(tv)}` : ""}`;
  return null;
}
