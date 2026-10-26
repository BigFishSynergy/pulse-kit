"use client";
import { useState } from "react";
import { deletePhoto, uploadPhoto } from "@/app/pulse/people-actions";

// Team photos on the People page: pick a photo, the browser crops it to a square and shrinks it, then it's saved.
type Person = { name: string; slug: string; v?: number };

async function squareJpeg(file: File, size = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const s = Math.min(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    // a little above center, where faces usually are
    c.getContext("2d")!.drawImage(img, (img.width - s) / 2, Math.max(0, (img.height - s) * 0.3), s, s, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function TeamPhotos({ people }: { people: Person[] }) {
  const [msg, setMsg] = useState("");
  const [v, setV] = useState<Record<string, number | undefined>>(Object.fromEntries(people.map((p) => [p.slug, p.v])));
  async function pick(slug: string, f?: File) {
    if (!f) return;
    setMsg("Saving...");
    try {
      const r = await uploadPhoto(slug, await squareJpeg(f));
      setMsg(r.error ?? r.done ?? "");
      if (!r.error) setV((x) => ({ ...x, [slug]: Date.now() }));
    } catch {
      setMsg("That photo could not be read. Try a JPG or PNG.");
    }
  }
  return (
    <section>
      <h2>Team photos <small>For the POWER cards on the Team page and the office TVs. Only use photos people are happy to have on the office TV.</small></h2>
      <div className="photo-grid">
        {people.map((p) => (
          <div key={p.slug} className="photo-cell">
            {v[p.slug] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/pulse/api/photo/${p.slug}?v=${v[p.slug]}`} alt={p.name} />
            ) : <span className="photo-none">{p.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>}
            <span className="m">{p.name}</span>
            <label className="btn">{v[p.slug] ? "Replace" : "Add photo"}<input type="file" accept="image/*" hidden onChange={(e) => pick(p.slug, e.target.files?.[0])} /></label>
            {v[p.slug] ? <button type="button" className="linkbtn" onClick={async () => { const r = await deletePhoto(p.slug); setMsg(r.error ?? r.done ?? ""); if (!r.error) setV((x) => ({ ...x, [p.slug]: undefined })); }}>Remove</button> : null}
          </div>
        ))}
      </div>
      {msg ? <p className="sub" role="status">{msg}</p> : null}
    </section>
  );
}
