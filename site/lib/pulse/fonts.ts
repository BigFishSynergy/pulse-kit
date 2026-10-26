import "server-only";

// Brand fonts embedded right inside a generated SVG, so a downloaded PNG uses Barlow Condensed and Inter
// instead of whatever fonts the viewer's computer has. Fetched from Google Fonts once per server instance.

const CSS_URL = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Inter:wght@400;600&display=swap";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

let cached: Promise<string> | null = null;

async function build(): Promise<string> {
  const css = await (await fetch(CSS_URL, { headers: { "User-Agent": UA } })).text();
  // keep only the latin blocks, then inline each woff2 file as base64
  const blocks = css.split("/* ").filter((b) => b.startsWith("latin */"));
  const out: string[] = [];
  for (const b of blocks) {
    const url = /url\((https:[^)]+\.woff2)\)/.exec(b)?.[1];
    const face = /@font-face\s*{[^}]*}/.exec(b)?.[0];
    if (!url || !face) continue;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    out.push(face.replace(url, `data:font/woff2;base64,${buf.toString("base64")}`));
  }
  return out.join("\n");
}

export function brandFontFaces(): Promise<string> {
  if (!cached) cached = build().catch(() => ((cached = null), ""));
  return cached;
}
