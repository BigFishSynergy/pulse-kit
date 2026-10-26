import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { CONFIG } from "./config";

// The company's own logo (pulse.config.json brand.logo, a file in public/), stamped onto generated graphics.
// Never recolored. Width and height come from the file for SVGs; PNGs use the box the graphic gives them.
export async function logoDataUri(): Promise<{ uri: string; w: number; h: number } | null> {
  const rel = CONFIG.brand.logo.replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", rel));
    const svg = rel.endsWith(".svg");
    let w = 300, h = 60;
    if (svg) {
      const vb = buf.toString("utf8").match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
      if (vb) { w = +vb[1]; h = +vb[2]; }
    } else if (buf.length > 24 && buf.toString("ascii", 12, 16) === "IHDR") {
      w = buf.readUInt32BE(16); h = buf.readUInt32BE(20);
    }
    return { uri: `data:${svg ? "image/svg+xml" : "image/png"};base64,${buf.toString("base64")}`, w, h };
  } catch {
    return null;
  }
}
