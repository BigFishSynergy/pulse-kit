"use client";
import { AVATARS } from "@/lib/pulse/faces";

// The 25 avatars (Notionists by Zoish, CC0), for anyone who'd rather not use a photo.
export default function AvatarPicker({ current, onPick }: { current?: string | null; onPick: (name: string) => void }) {
  return (
    <div className="avatar-pick" role="list">
      {AVATARS.map((a) => (
        <button key={a} type="button" role="listitem" className={current === `avatar:${a}` ? "on" : ""} onClick={() => onPick(a)} aria-label={`Avatar ${a}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/pulse/avatars/${a}.svg`} alt="" />
        </button>
      ))}
    </div>
  );
}
