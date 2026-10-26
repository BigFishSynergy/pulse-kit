// Where a person's face comes from, for every card, ranking and TV: an uploaded photo (a version number, served privately
// by /pulse/api/photo/<slug>) or one of the 25 avatars they picked ("avatar:<name>", public/pulse/avatars, made with
// DiceBear: Bottts robots, Pixel Art, Thumbs; free, no credit needed). Uploaded photos become a two-tone picture in one
// of the same bold colors, in the browser, so photos and avatars look like one set, Netflix style.
import LIST from "@/public/pulse/avatars/index.json";

export const AVATARS: string[] = LIST as string[];
export type Face = number | string | undefined | null;
export const isAvatar = (v: Face): v is string => typeof v === "string" && v.startsWith("avatar:") && AVATARS.includes(v.slice(7));

export function faceSrc(slug: string, v: Face, tv?: string): string | null {
  if (isAvatar(v)) return `/pulse/avatars/${v.slice(7)}.svg`;
  if (typeof v === "number") return `/pulse/api/photo/${slug}?v=${v}${tv ? `&tv=${encodeURIComponent(tv)}` : ""}`;
  return null;
}

/** The bold colors behind the avatars, and each person's color for their photo (the same one every time). */
export const COLORS = ["#E50914", "#0071EB", "#F5C518", "#46D369", "#9B5DE5", "#FF7A00", "#00B8D9", "#FF4FA3"];
export const colorFor = (slug: string) => COLORS[[...slug].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % COLORS.length];
