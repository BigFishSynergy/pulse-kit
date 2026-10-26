"use client";
import { useState } from "react";
import { uploadMyPhoto } from "@/app/pulse/people-actions";
import { squareJpeg } from "./TeamPhotos";

// A rep's or CSR's own photo, from their own screen: it shows on their POWER card, on the Pulse and on the office TVs.
// They can only change their own; leadership can replace or remove anyone's on the People page.
export default function MyPhoto({ slug, name, v }: { slug: string; name: string; v?: number }) {
  const [ver, setVer] = useState(v);
  const [msg, setMsg] = useState("");
  async function pick(f?: File) {
    if (!f) return;
    setMsg("Saving...");
    try {
      const r = await uploadMyPhoto(await squareJpeg(f));
      setMsg(r.error ?? r.done ?? "");
      if (!r.error) setVer(Date.now());
    } catch {
      setMsg("That photo could not be read. Try a JPG or PNG.");
    }
  }
  return (
    <section className="myphoto">
      {ver ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/pulse/api/photo/${slug}?v=${ver}`} alt="" />
      ) : <span className="photo-none">{name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>}
      <div>
        <h2>{ver ? "Your photo" : "Add your photo"}</h2>
        <p className="sub">It shows on your POWER card for the team{ver ? "" : ". A clear, friendly face shot works best"}.</p>
        {msg ? <p className="sub" role="status">{msg}</p> : null}
      </div>
      <label className="btn">{ver ? "Change my photo" : "Add my photo"}<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
    </section>
  );
}
