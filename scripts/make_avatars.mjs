// Makes the 25 avatars in site/public/pulse/avatars (Notionists by Zoish, CC0 1.0, via DiceBear). Each one has its own
// hairstyle (long, short, curly, spiky, a top knot, head coverings), with beards, glasses and a few waves mixed in, so
// the set covers a real range of people. Run in a folder where @dicebear/core@9.2.2 and @dicebear/collection@9.2.2 are
// installed: node make_avatars.mjs <out folder>
import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";
import { writeFileSync } from "node:fs";

const out = process.argv[2];
const v = (n) => `variant${String(n).padStart(2, "0")}`;
// name, hair, then optional beard, glasses, gesture
const SET = [
  ["ace", 1, 3], ["blaze", 2, 0, 4], ["comet", 8], ["dash", 9, 7], ["echo", 10, 0, 0, "wavePointLongArms"],
  ["flint", 14, 0, 2], ["gale", 20, 10], ["hawk", 23], ["iris", 26, 0, 9], ["jett", 28, 0, 0, "ok"],
  ["knox", 36], ["luna", 39, 0, 6], ["maverick", 41], ["nova", 42, 5], ["onyx", 45, 0, 0, "waveLongArms"],
  ["pike", 46, 0, 1], ["quinn", 47], ["ridge", 50, 0, 11], ["sage", 51, 2], ["titan", 57, 0, 0, "point"],
  ["ursa", 58, 0, 8], ["vale", 59], ["wren", 60, 12, 3], ["xena", 61], ["zeke", 63, 0, 0, "hand"],
];
for (const [name, hair, beard, glasses, gesture] of SET) {
  const svg = createAvatar(notionists, {
    seed: name, size: 256, hair: [v(hair)],
    beard: beard ? [v(beard)] : undefined, beardProbability: beard ? 100 : 0,
    glasses: glasses ? [v(glasses)] : undefined, glassesProbability: glasses ? 100 : 0,
    gesture: gesture ? [gesture] : undefined, gestureProbability: gesture ? 100 : 0,
  }).toString();
  writeFileSync(`${out}/${name}.svg`, svg);
}
writeFileSync(`${out}/index.json`, JSON.stringify(SET.map((x) => x[0])));
