// Makes the 25 avatars in site/public/pulse/avatars: Netflix-style character heads on bold colors, in three free sets
// that need no credit: Bottts robots (Pablo Stanley, free for personal and commercial use), Pixel Art and Thumbs
// (DiceBear, CC0 1.0), all made with DiceBear. Run in a folder where @dicebear/core@9.2.2 and @dicebear/collection@9.2.2
// are installed: node make_avatars.mjs <out folder>
import { createAvatar } from "@dicebear/core";
import { bottts, pixelArt, thumbs } from "@dicebear/collection";
import { writeFileSync } from "node:fs";

const out = process.argv[2];
// the same bold colors as the photo look (lib/pulse/faces.ts COLORS)
const COLORS = ["E50914", "0071EB", "F5C518", "46D369", "9B5DE5", "FF7A00", "00B8D9", "FF4FA3"];
const SET = [
  ["bolt", bottts], ["sprocket", bottts], ["gizmo", bottts], ["rivet", bottts], ["servo", bottts], ["turbo", bottts], ["chip", bottts], ["widget", bottts], ["zap", bottts],
  ["byte", pixelArt], ["arcade", pixelArt], ["retro", pixelArt], ["glitch", pixelArt], ["joy", pixelArt], ["level", pixelArt], ["combo", pixelArt], ["boss", pixelArt],
  ["mochi", thumbs], ["bean", thumbs], ["gummy", thumbs], ["puff", thumbs], ["jelly", thumbs], ["boo", thumbs], ["dot", thumbs], ["blip", thumbs],
];
SET.forEach(([name, style], i) => {
  writeFileSync(`${out}/${name}.svg`, createAvatar(style, { seed: name, size: 256, backgroundColor: [COLORS[(i * 3) % COLORS.length]] }).toString());
});
writeFileSync(`${out}/index.json`, JSON.stringify(SET.map((x) => x[0])));
writeFileSync(`${out}/LICENSE.md`, `# Avatars

The 25 avatars in this folder were made with DiceBear (https://www.dicebear.com) from three sets that are free to use for any purpose, including commercial, with no credit required:

- Bottts by Pablo Stanley (https://bottts.com): free for personal and commercial use.
- Pixel Art by DiceBear: CC0 1.0 (public domain).
- Thumbs by DiceBear: CC0 1.0 (public domain).

Remade with scripts/make_avatars.mjs in the Pulse Kit.
`);
