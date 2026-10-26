"use client";
import { useState } from "react";
import type { Req, Status } from "@/lib/pulse/requests";
import { Seg } from "./ui";

const LABEL: Record<Status, string> = { new: "New", planned: "Planned", done: "Done", not_now: "Not now" };

export default function RequestsView({ initial }: { initial: Req[] }) {
  const [rows, setRows] = useState(initial);
  const [show, setShow] = useState<"open" | "all">("open");
  const [err, setErr] = useState("");
  const [replying, setReplying] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  async function set(id: string, status: Status, note?: string) {
    setErr("");
    const r = await fetch("/pulse/api/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, note }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setRows((rs) => rs.map((x) => (x.id === id ? j.request : x))); setReplying(null); }
    else setErr(j.error || "Could not save that.");
  }
  const list = rows.filter((r) => show === "all" || r.status === "new" || r.status === "planned");
  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  return (
    <section>
      <div className="sechead">
        <h2>Requests <small>Ideas and fixes from the team. {counts.new || 0} new, {counts.planned || 0} planned, {counts.done || 0} done.</small></h2>
        <Seg label="Show" value={show} options={[["open", "New and planned"], ["all", "Everything"]]} onChange={(v) => setShow(v as "open" | "all")} />
      </div>
      {err ? <p className="err">{err}</p> : null}
      {list.length ? (
        <div className="tbl"><table>
          <thead><tr><th>When</th><th>From</th><th>Type</th><th>Request</th><th>Page</th><th>Status</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id}>
              <td className="num">{new Date(r.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
              <td className="m">{r.name}<div className="sub">{r.role === "lead" ? "Leadership" : r.role === "csr" ? "CSR" : "Sales"}</div></td>
              <td>{r.kind}</td>
              <td style={{ maxWidth: 460, whiteSpace: "pre-wrap" }}>
                {r.text}
                {r.note && replying !== r.id ? <p className="explain"><b>Reply:</b> {r.note}</p> : null}
                {replying === r.id ? (
                  <div className="btns" style={{ marginTop: 8 }}>
                    <textarea rows={2} maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Your reply" />
                    <button type="button" className="btn primary" disabled={draft.trim().length < 2} onClick={() => set(r.id, r.status, draft.trim())}>Save reply</button>
                    <button type="button" className="link" onClick={() => setReplying(null)}>Cancel</button>
                  </div>
                ) : (
                  <div><button type="button" className="link" onClick={() => { setReplying(r.id); setDraft(r.note || ""); }}>{r.note ? "Edit reply" : "Reply"}</button></div>
                )}
              </td>
              <td className="sub">{r.page}</td>
              <td><Seg label="Status" value={r.status} options={(Object.keys(LABEL) as Status[]).map((k) => [k, LABEL[k]] as [string, string])} onChange={(v) => set(r.id, v as Status)} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty-note">{rows.length ? "Nothing open. Switch to Everything to see the rest." : "No requests yet. They show up here as soon as someone sends one."}</div>}
      <p className="explain">Every request posts to the Pulse Slack channel right away, in the person's own words, and shows up on this page. Replies show under each request, for every leader to see. To build any of these, open a Claude session and say which ones.</p>
    </section>
  );
}
