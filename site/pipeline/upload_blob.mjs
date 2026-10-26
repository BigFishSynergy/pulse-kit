// Upload the built Pulse data to the private Vercel Blob store the site reads from.
// Usage: node upload_blob.mjs <data dir>     (needs BLOB_READ_WRITE_TOKEN)
// Uploads latest/, this week's archive, the week index, coaching and Speed Round files, skipping any file whose content
// has not changed since the last upload (a manifest of hashes lives in <data dir>/.blob-manifest.json).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { put } from "@vercel/blob";

const dir = process.argv[2];
if (!dir || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.log("upload_blob: no data dir or no BLOB_READ_WRITE_TOKEN, skipping");
  process.exit(0);
}
const meta = JSON.parse(readFileSync(join(dir, "latest", "meta.json"), "utf8"));
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);
const files = [
  ...walk(join(dir, "latest")),
  ...walk(join(dir, "weeks", meta.week_start)),
  join(dir, "weeks", "index.json"),
  ...walk(join(dir, "coaching")),
  ...walk(join(dir, "quiz")),
].filter((f) => f.endsWith(".json") && existsSync(f));

const manifestPath = join(dir, ".blob-manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
let sent = 0;
for (const f of files) {
  const body = readFileSync(f);
  const path = relative(dir, f).split("\\").join("/");
  const hash = createHash("sha256").update(body).digest("hex");
  if (manifest[path] === hash) continue;
  await put(path, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  manifest[path] = hash;
  sent++;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`upload_blob: ${sent} of ${files.length} files changed and uploaded`);
