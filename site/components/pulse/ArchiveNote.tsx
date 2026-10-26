import Link from "next/link";
import { dfmt } from "@/lib/pulse/format";

/** Shown while someone looks back at an earlier week's saved numbers, with the way back to the latest. */
export default function ArchiveNote({ week, back }: { week?: string; back: string }) {
  if (!week) return null;
  return <div className="risk">You are looking at the numbers saved for the week of {dfmt(week)}. <Link href={back}>Back to the latest numbers</Link></div>;
}
