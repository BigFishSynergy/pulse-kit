"use client";
import { useState } from "react";
import { deletePhoto, pickAvatar, uploadPhoto } from "@/app/pulse/people-actions";
import { faceSrc, type Face } from "@/lib/pulse/faces";
import AvatarPicker from "./AvatarPicker";

// Team photos on the People page: a photo (the browser crops it square, shrinks it and turns it black and white, so every
// face on the board matches) or one of the 25 avatars.
type Person = { name: string; slug: string; v?: Face };

/** A square, black and white JPEG of the photo, cropped a little above center where faces usually are. */
export async function squareJpeg(file: File, size = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const s = Math.min(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    g.drawImage(img, (img.width - s) / 2, Math.max(0, (img.height - s) * 0.3), s, s, 0, 0, size, size);
    const d = g.getImageData(0, 0, size, size), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const v = Math.max(0, Math.min(255, (y - 128) * 1.12 + 128)); // a touch more contrast
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2);

export default function TeamPhotos({ people }: { people: Person[] }) {
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState("");
  const [v, setV] = useState<Record<string, Face>>(Object.fromEntries(people.map((p) => [p.slug, p.v])));
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
      <h2>Team photos <small>A photo (turned black and white so the board matches) or one of 25 avatars, for the POWER cards. Reps and CSRs can also set their own. Only use photos people are happy to have on the office TV.</small></h2>
      <div className="photo-grid">
        {people.map((p) => {
          const src = faceSrc(p.slug, v[p.slug]);
          return (
            <div key={p.slug} className="photo-cell">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src ? <img className="face" src={src} alt={p.name} /> : <span className="photo-none">{initials(p.name)}</span>}
              <span className="m">{p.name}</span>
              <label className="btn">{typeof v[p.slug] === "number" ? "Replace photo" : "Add photo"}<input type="file" accept="image/*" hidden onChange={(e) => pick(p.slug, e.target.files?.[0])} /></label>
              <button type="button" className="linkbtn" onClick={() => setOpen(open === p.slug ? "" : p.slug)}>{open === p.slug ? "Close avatars" : "Pick an avatar"}</button>
              {v[p.slug] ? <button type="button" className="linkbtn" onClick={async () => { const r = await deletePhoto(p.slug); setMsg(r.error ?? r.done ?? ""); if (!r.error) setV((x) => ({ ...x, [p.slug]: undefined })); }}>Remove</button> : null}
            </div>
          );
        })}
      </div>
      {open ? (
        <div className="avatar-panel">
          <p className="sub">Pick an avatar for {people.find((p) => p.slug === open)?.name}:</p>
          <AvatarPicker current={typeof v[open] === "string" ? (v[open] as string) : null} onPick={async (a) => { const r = await pickAvatar(open, a); setMsg(r.error ?? r.done ?? ""); if (!r.error) { setV((x) => ({ ...x, [open]: `avatar:${a}` })); setOpen(""); } }} />
        </div>
      ) : null}
      {msg ? <p className="sub" role="status">{msg}</p> : null}
    </section>
  );
}
