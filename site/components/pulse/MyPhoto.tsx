"use client";
import { useState } from "react";
import { pickMyAvatar, uploadMyPhoto } from "@/app/pulse/people-actions";
import { colorFor, faceSrc, type Face } from "@/lib/pulse/faces";
import AvatarPicker from "./AvatarPicker";
import { squareJpeg } from "./TeamPhotos";

// A rep's or CSR's own face on their POWER card: a photo (made a colorful two-tone picture so the board matches) or one of 25
// avatars. They can only change their own; leadership can change anyone's on the People page.
export default function MyPhoto({ slug, name, v }: { slug: string; name: string; v?: Face }) {
  const [ver, setVer] = useState<Face>(v);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const src = faceSrc(slug, ver);
  async function pick(f?: File) {
    if (!f) return;
    setMsg("Saving...");
    try {
      const r = await uploadMyPhoto(await squareJpeg(f, colorFor(slug)));
      setMsg(r.error ?? r.done ?? "");
      if (!r.error) setVer(Date.now());
    } catch {
      setMsg("That photo could not be read. Try a JPG or PNG.");
    }
  }
  return (
    <section className="myphoto-wrap">
      <div className="myphoto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img className="face" src={src} alt="" /> : <span className="photo-none">{name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>}
        <div>
          <h2>{src ? "Your card face" : "Add your face to your card"}</h2>
          <p className="sub">A photo (it becomes a colorful two-tone picture so the whole board matches) or one of 25 avatars.</p>
          {msg ? <p className="sub" role="status">{msg}</p> : null}
        </div>
        <div className="myphoto-btns">
          <label className="btn">{typeof ver === "number" ? "Change my photo" : "Add my photo"}<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
          <button type="button" className="btn" onClick={() => setOpen(!open)}>{open ? "Close avatars" : "Pick an avatar"}</button>
        </div>
      </div>
      {open ? <AvatarPicker current={typeof ver === "string" ? ver : null} onPick={async (a) => { const r = await pickMyAvatar(a); setMsg(r.error ?? r.done ?? ""); if (!r.error) { setVer(`avatar:${a}`); setOpen(false); } }} /> : null}
    </section>
  );
}
