import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homeOf, linkOnDevice } from "@/lib/pulse/auth";
import { linkUrl } from "@/lib/pulse/links";
import CopyLink from "@/components/pulse/CopyLink";
import { adminFirst, CO, CONFIG } from "@/lib/pulse/config";

export const dynamic = "force-dynamic";

// Where a sign-in link lands the first time it is used on a phone or computer (app/pulse/k/[token]/route.ts). It shows the
// person their own link, because the page they land on next has no key in it and only works where they are already signed in.
export default function SignedIn() {
  const s = getSession();
  if (!s) redirect("/pulse");
  const home = `${homeOf(s.role)}?welcome=1`;
  const token = linkOnDevice(s);
  if (!token) redirect(home);
  return (
    <div className="wrap">
      <div className="login">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={CO.name} src={CONFIG.brand.logo} width={194} height={40} style={{ height: 40, width: "auto" }} />
        <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 0.95 }}>You&apos;re signed in</h1>
        <p className="sub">Hi {s.name.split(" ")[0]}. This phone or computer stays signed in. Here is your own sign-in link:</p>
        <CopyLink url={linkUrl(token)} />
        <p><b>Save or share this link, not the page you land on next. This is the one that signs you in.</b></p>
        <div className="btns"><Link className="btn primary" href={home}>Continue</Link></div>
        <p className="sub">You can find this link again any time in the menu at the top, under My sign-in link.</p>
      </div>
    </div>
  );
}
