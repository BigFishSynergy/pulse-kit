// Lists the company's AccuLynx scheduled reports (ID, name, last run, the files each sent), so the IDs can go in the
// ACCULYNX_SCHEDULES repo variable. Read only. Run it from the Actions tab (acculynx-list-schedules) so the API key
// stays a GitHub secret and never sits on anyone's computer. Prints no customer data, only report names and file names.
const key = process.env.ACCULYNX_API_KEY;
if (!key) { console.error("Missing ACCULYNX_API_KEY (repo secret)"); process.exit(1); }
const BASE = "https://api.acculynx.com/api/v2";
const get = async (path) => {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${path.split("?")[0]}`);
  return r.json();
};
const list = await get("/reports/scheduled-reports?pageSize=50&pageStartIndex=0").catch((e) => { console.error(`Could not list schedules (${e.message}). If this keeps happening, open each scheduled report in AccuLynx and copy the ID from the address bar.`); process.exit(1); });
const items = list?.items ?? [];
if (!items.length) console.log("No scheduled reports yet. Schedule the three reports in AccuLynx first (guides/acculynx-guide.md).");
for (const s of items) {
  const id = s.id ?? s.scheduledReportId ?? s.reportScheduleId;
  let files = "";
  try {
    const run = await get(`/reports/scheduled-reports/${id}/runs/latest`);
    const rec = run?.runInstanceId ? await get(`/reports/scheduled-reports/${id}/runs/${run.runInstanceId}/recipients`) : null;
    files = [...new Set((rec?.items ?? []).flatMap((x) => (x.files ?? []).map((f) => decodeURIComponent((f.fileUrl || "").split("?")[0].split("/").pop()))))].join(", ");
    console.log(`${id}  ${s.name ?? s.reportName ?? ""}  last run ${run?.date ?? "none yet"}  files: ${files || "none"}`);
  } catch {
    console.log(`${id}  ${s.name ?? s.reportName ?? ""}`);
  }
}
console.log("\nPut the IDs in the repo variable ACCULYNX_SCHEDULES like this: id1:Morning,id2:Afternoon");
